import { PixelKernels, bayerMatrix, cpuKernels, inks } from "../kernels";
import { RGB } from "../palette";
import { HalftoneScreen, cellSamples, dotShapeIndex, toneTable, toneTableSize } from "../halftone";

/** Largest palette the GPU kernel supports; larger palettes fall back to the CPU. */
export const maxGpuPaletteSize = 64;

// WebGL2 implementations of the pixel kernels. One shared OffscreenCanvas context renders each
// kernel as a full-screen fragment shader; results are copied into ordinary 2D canvases, so the
// rest of the engine (Canvas 2D composition) is unchanged. Colors stay in straight (non-premultiplied)
// alpha end to end, matching ImageData semantics in the CPU reference.

const vertexShader = `#version 300 es
void main() {
  // Full-screen triangle from the vertex index; no buffers needed.
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const fragmentPrelude = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D u_input;
uniform ivec2 u_size;
out vec4 outColor;
// This fragment's pixel in canvas coordinates (rows top-down; GL's run bottom-up).
ivec2 canvasCoord() {
  return ivec2(int(gl_FragCoord.x), u_size.y - 1 - int(gl_FragCoord.y));
}
// A pixel in 0..255 straight alpha, clamped to the image edges.
vec4 pixelAt(ivec2 p) {
  return texelFetch(u_input, clamp(p, ivec2(0), u_size - 1), 0) * 255.0;
}
vec4 inputPixel() {
  return pixelAt(canvasCoord());
}
float lum(vec3 c) {
  return 0.21 * c.r + 0.72 * c.g + 0.07 * c.b;
}
// JavaScript's Math.round for non-negative values.
float roundJs(float v) {
  return floor(v + 0.5);
}
`;

const thresholdShader = fragmentPrelude + `
uniform float u_value;
void main() {
  vec4 c = inputPixel();
  // Same luminance weights and flooring as the CPU reference.
  float v = floor((c.a / 255.0) * (c.r * 0.21 + c.g * 0.72 + c.b * 0.07));
  outColor = v < u_value ? vec4(0.0, 0.0, 0.0, 1.0) : vec4(1.0);
}`;

const rgbChannelsShader = fragmentPrelude + `
uniform int u_channel;
void main() {
  vec4 c = inputPixel() / 255.0;
  vec3 rgb = vec3(1.0);
  rgb[u_channel] = c[u_channel];
  outColor = vec4(rgb, c.a);
}`;

const noiseShader = fragmentPrelude + `
uniform float u_amount;
uniform bool u_mono;
uniform uint u_seed;
// PCG hash: fast, well-distributed integer noise.
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float randomByte(uint i) {
  return floor(float(pcg(i) % 0x1000000u) / float(0x1000000u) * 255.0) / 255.0;
}
void main() {
  uint index = (uint(gl_FragCoord.y) * uint(u_size.x) + uint(gl_FragCoord.x)) * 3u + u_seed;
  float r = randomByte(index);
  vec3 noise = u_mono ? vec3(r) : vec3(r, randomByte(index + 1u), randomByte(index + 2u));
  // Opaque noise drawn over the input at u_amount opacity (source-over), in straight alpha.
  vec4 c = inputPixel() / 255.0;
  float a = u_amount + c.a * (1.0 - u_amount);
  vec3 rgb = a == 0.0 ? vec3(0.0) : (noise * u_amount + c.rgb * c.a * (1.0 - u_amount)) / a;
  outColor = vec4(rgb, a);
}`;

const paletteShader = fragmentPrelude + `
const int MAX_COLORS = ${maxGpuPaletteSize};
uniform vec3 u_match[MAX_COLORS];
uniform vec3 u_paint[MAX_COLORS];
uniform int u_count;
uniform int u_only;
void main() {
  vec4 c = inputPixel();
  int best = 0;
  float bestDistance = 1e20;
  for (int i = 0; i < MAX_COLORS; i++) {
    if (i >= u_count) break;
    vec3 d = c.rgb - u_match[i];
    float distance = dot(d, d);
    // Strictly less: ties go to the earlier (darker) color, as in the CPU reference.
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  if (u_only >= 0 && best != u_only) {
    outColor = vec4(0.0);
    return;
  }
  outColor = vec4(u_paint[best] / 255.0, c.a / 255.0);
}`;

const levelsShader = fragmentPrelude + `
uniform float u_black;
uniform float u_white;
uniform float u_gamma;
void main() {
  vec4 c = inputPixel();
  vec3 t = clamp((c.rgb - u_black) / max(1.0, u_white - u_black), 0.0, 1.0);
  vec3 v = floor(255.0 * pow(t, vec3(1.0 / max(0.01, u_gamma))) + 0.5);
  outColor = vec4(v / 255.0, c.a / 255.0);
}`;

const gradientMapShader = fragmentPrelude + `
uniform vec3 u_stops[8];
uniform int u_count;
void main() {
  vec4 c = inputPixel();
  vec3 rgb = u_stops[0];
  if (u_count > 1) {
    float t = clamp(lum(c.rgb) / 255.0, 0.0, 1.0) * float(u_count - 1);
    int i = min(u_count - 2, int(floor(t)));
    float f = t - float(i);
    rgb = vec3(roundJs(u_stops[i].r + (u_stops[i + 1].r - u_stops[i].r) * f),
               roundJs(u_stops[i].g + (u_stops[i + 1].g - u_stops[i].g) * f),
               roundJs(u_stops[i].b + (u_stops[i + 1].b - u_stops[i].b) * f));
  }
  outColor = vec4(rgb / 255.0, c.a / 255.0);
}`;

const posterizeShader = fragmentPrelude + `
uniform float u_levels;
void main() {
  vec4 c = inputPixel();
  vec3 v = floor(floor(c.rgb / 255.0 * (u_levels - 1.0) + 0.5) / (u_levels - 1.0) * 255.0 + 0.5);
  outColor = vec4(v / 255.0, c.a / 255.0);
}`;

const orderedDitherShader = fragmentPrelude + `
uniform float u_bayer[64];
uniform int u_n;
uniform float u_levels;
uniform bool u_mono;
uniform int u_pixelSize;
float dither(float v, float t) {
  return roundJs(min(u_levels - 1.0, floor(v / 255.0 * (u_levels - 1.0) + t)) / (u_levels - 1.0) * 255.0);
}
void main() {
  ivec2 p = canvasCoord() / u_pixelSize;
  float t = (u_bayer[(p.y % u_n) * u_n + (p.x % u_n)] + 0.5) / float(u_n * u_n);
  vec4 c = inputPixel();
  vec3 v = u_mono ? vec3(dither(lum(c.rgb), t)) : vec3(dither(c.r, t), dither(c.g, t), dither(c.b, t));
  outColor = vec4(v / 255.0, c.a / 255.0);
}`;

const edgesShader = fragmentPrelude + `
uniform float u_strength;
uniform float u_threshold;
uniform bool u_invert;
float l(int dx, int dy) {
  vec4 c = pixelAt(canvasCoord() + ivec2(dx, dy));
  return lum(c.rgb) * c.a / 255.0;
}
void main() {
  float gx = l(1, -1) + 2.0 * l(1, 0) + l(1, 1) - l(-1, -1) - 2.0 * l(-1, 0) - l(-1, 1);
  float gy = l(-1, 1) + 2.0 * l(0, 1) + l(1, 1) - l(-1, -1) - 2.0 * l(0, -1) - l(1, -1);
  float line = min(1.0, sqrt(gx * gx + gy * gy) / (4.0 * 255.0) * u_strength);
  if (u_threshold > 0.0) {
    line = line * 255.0 >= u_threshold ? 1.0 : 0.0;
  }
  float v = roundJs(255.0 * (u_invert ? line : 1.0 - line));
  outColor = vec4(vec3(v / 255.0), 1.0);
}`;

const colorKeyShader = fragmentPrelude + `
uniform vec3 u_key;
uniform float u_tolerance;
uniform float u_softness;
void main() {
  vec4 c = inputPixel();
  float d = length(c.rgb - u_key);
  float f = u_softness <= 0.0 ? (d > u_tolerance ? 1.0 : 0.0) : clamp((d - u_tolerance) / u_softness, 0.0, 1.0);
  outColor = vec4(c.rgb / 255.0, roundJs(c.a * f) / 255.0);
}`;

const cmykShader = fragmentPrelude + `
uniform int u_channel;
uniform bool u_amount;
uniform vec3 u_ink;
void main() {
  vec4 c = inputPixel();
  vec3 cmy = 1.0 - c.rgb / 255.0;
  float k = min(cmy.r, min(cmy.g, cmy.b));
  vec4 amounts = k >= 1.0 ? vec4(0.0, 0.0, 0.0, 1.0) : vec4((cmy - k) / (1.0 - k), k);
  float t = amounts[u_channel];
  vec3 v = u_amount
    ? vec3(roundJs(255.0 * (1.0 - t)))
    : vec3(roundJs(255.0 - t * (255.0 - u_ink.r)), roundJs(255.0 - t * (255.0 - u_ink.g)), roundJs(255.0 - t * (255.0 - u_ink.b)));
  outColor = vec4(v / 255.0, c.a / 255.0);
}`;

const halftoneShader = fragmentPrelude + `
uniform vec2 u_outSize;
uniform float u_scale;
uniform float u_cell;
uniform float u_angle;
uniform int u_shape;
uniform bool u_invert;
uniform float u_lut[${toneTableSize}];
// Spot functions, in sync with halftone.ts.
float spot(vec2 f) {
  if (u_shape == 1) return (f.x * f.x + 1.7 * f.y * f.y) / 2.7;
  if (u_shape == 2) return abs(f.y);
  if (u_shape == 3) return (abs(f.x) + abs(f.y)) / 2.0;
  return (f.x * f.x + f.y * f.y) / 2.0;
}
float thresholdFor(float d) {
  float t = clamp(d, 0.0, 1.0) * float(${toneTableSize - 1});
  int i = min(${toneTableSize - 2}, int(floor(t)));
  return mix(u_lut[i], u_lut[i + 1], t - float(i));
}
void main() {
  // Output pixel center in canvas coordinates (y down), then in input pixels.
  vec2 p = vec2(gl_FragCoord.x, u_outSize.y - gl_FragCoord.y) / u_scale;
  float c = cos(radians(u_angle)), s = sin(radians(u_angle));
  vec2 q = vec2(c * p.x + s * p.y, -s * p.x + c * p.y) / u_cell;
  vec2 k = floor(q);
  vec2 f = (q - k - 0.5) * 2.0;
  // Mean darkness over the cell (bilinear samples on a grid, clamped to edges), transparent as white.
  float d = 0.0;
  for (int j = 0; j < ${cellSamples}; j++) {
    for (int i = 0; i < ${cellSamples}; i++) {
      vec2 cq = (k + (vec2(float(i), float(j)) + 0.5) / float(${cellSamples})) * u_cell;
      vec2 cp = vec2(c * cq.x - s * cq.y, s * cq.x + c * cq.y);
      vec4 px = texture(u_input, clamp(cp, vec2(0.5), vec2(u_size) - 0.5) / vec2(u_size)) * 255.0;
      float a = px.a / 255.0;
      d += 1.0 - (lum(px.rgb) * a + 255.0 * (1.0 - a)) / 255.0;
    }
  }
  d /= float(${cellSamples * cellSamples});
  if (u_invert) d = 1.0 - d;
  float v = spot(f);
  float coverage = clamp((thresholdFor(d) - v) / max(fwidth(v), 1e-4) + 0.5, 0.0, 1.0);
  float ink = u_invert ? 1.0 : 0.0;
  float paper = 1.0 - ink;
  outColor = vec4(vec3(roundJs(255.0 * mix(paper, ink, coverage)) / 255.0), 1.0);
}`;

type Program = {
  program: WebGLProgram,
  uniform: (name: string) => WebGLUniformLocation | null
};

const compile = (gl: WebGL2RenderingContext, fragmentSource: string): Program => {
  const shader = (type: number, source: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(`Shader compile failed: ${gl.getShaderInfoLog(s)}`);
    }
    return s;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, shader(gl.VERTEX_SHADER, vertexShader));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Shader link failed: ${gl.getProgramInfoLog(program)}`);
  }
  const locations = new Map<string, WebGLUniformLocation | null>();
  const uniform = (name: string) => {
    if (!locations.has(name)) {
      locations.set(name, gl.getUniformLocation(program, name));
    }
    return locations.get(name)!;
  };
  return { program, uniform };
};

type GpuContext = {
  canvas: OffscreenCanvas,
  gl: WebGL2RenderingContext,
  texture: WebGLTexture,
  programs: {
    threshold: Program, rgbChannels: Program, noise: Program, palette: Program, levels: Program,
    gradientMap: Program, posterize: Program, orderedDither: Program, edges: Program, colorKey: Program, cmyk: Program,
    halftone: Program
  },
  lost: boolean
};

const createContext = (): GpuContext | undefined => {
  if (typeof OffscreenCanvas === 'undefined') {
    return undefined;
  }
  const canvas = new OffscreenCanvas(1, 1);
  const gl = canvas.getContext('webgl2', {
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
    antialias: false,
    depth: false,
    stencil: false,
  });
  if (!gl) {
    return undefined;
  }
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  const ctx: GpuContext = {
    canvas,
    gl,
    texture,
    programs: {
      threshold: compile(gl, thresholdShader),
      rgbChannels: compile(gl, rgbChannelsShader),
      noise: compile(gl, noiseShader),
      palette: compile(gl, paletteShader),
      levels: compile(gl, levelsShader),
      gradientMap: compile(gl, gradientMapShader),
      posterize: compile(gl, posterizeShader),
      orderedDither: compile(gl, orderedDitherShader),
      edges: compile(gl, edgesShader),
      colorKey: compile(gl, colorKeyShader),
      cmyk: compile(gl, cmykShader),
      halftone: compile(gl, halftoneShader),
    },
    lost: false,
  };
  canvas.addEventListener('webglcontextlost', () => { ctx.lost = true; });
  return ctx;
};

/**
 * Uploads `input`, runs `program` over it, and returns the result as a new 2D canvas
 * (input-sized unless `output` says otherwise; `linear` enables bilinear sampling).
 */
const run = (
  ctx: GpuContext,
  input: OffscreenCanvas,
  program: Program,
  setUniforms: (p: Program) => void,
  output?: { width: number, height: number, linear?: boolean }
): OffscreenCanvas => {
  const { gl, canvas } = ctx;
  const { width: inWidth, height: inHeight } = input;
  const width = output?.width ?? inWidth, height = output?.height ?? inHeight;
  canvas.width = width;
  canvas.height = height;
  gl.viewport(0, 0, width, height);
  gl.bindTexture(gl.TEXTURE_2D, ctx.texture);
  const filter = output?.linear ? gl.LINEAR : gl.NEAREST;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, input);
  gl.useProgram(program.program);
  gl.uniform1i(program.uniform('u_input'), 0);
  gl.uniform2i(program.uniform('u_size'), inWidth, inHeight);
  setUniforms(program);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  const out = new OffscreenCanvas(width, height);
  out.getContext('2d')!.drawImage(canvas, 0, 0);
  return out;
};

let seed = 1;

/**
 * GPU kernels, or undefined when WebGL2 is unavailable. Zero-area inputs and a lost context fall
 * back to the CPU reference per call.
 */
export const createWebglKernels = (): PixelKernels | undefined => {
  let ctx: GpuContext | undefined;
  try {
    ctx = createContext();
  } catch (e) {
    console.warn('WebGL2 kernels unavailable', e);
    return undefined;
  }
  if (!ctx) {
    return undefined;
  }
  const gpu = ctx;
  const usable = (input: OffscreenCanvas) => !gpu.lost && input.width > 0 && input.height > 0;

  return {
    name: 'webgl2',

    threshold: async (input, value) =>
      !usable(input)
      ? cpuKernels.threshold(input, value)
      : run(gpu, input, gpu.programs.threshold, p => gpu.gl.uniform1f(p.uniform('u_value'), value)),

    noise: async (input, op) =>
      !usable(input)
      ? cpuKernels.noise(input, op)
      : run(gpu, input, gpu.programs.noise, p => {
        gpu.gl.uniform1f(p.uniform('u_amount'), op.amount / 100);
        gpu.gl.uniform1i(p.uniform('u_mono'), op.monochromatic ? 1 : 0);
        // Fresh randomness per call, like Math.random in the CPU reference.
        seed = (seed * 1103515245 + 12345) >>> 0;
        gpu.gl.uniform1ui(p.uniform('u_seed'), seed);
      }),

    mapToPalette: async (input, match, paint, only) =>
      !usable(input) || match.length === 0 || match.length > maxGpuPaletteSize
      ? cpuKernels.mapToPalette(input, match, paint, only)
      : run(gpu, input, gpu.programs.palette, p => {
        const flat = (colors: RGB[]) => new Float32Array(colors.flat());
        gpu.gl.uniform3fv(p.uniform('u_match'), flat(match));
        gpu.gl.uniform3fv(p.uniform('u_paint'), flat(paint));
        gpu.gl.uniform1i(p.uniform('u_count'), match.length);
        gpu.gl.uniform1i(p.uniform('u_only'), only ?? -1);
      }),

    levels: async (input, black, white, gamma) =>
      !usable(input)
      ? cpuKernels.levels(input, black, white, gamma)
      : run(gpu, input, gpu.programs.levels, p => {
        gpu.gl.uniform1f(p.uniform('u_black'), black);
        gpu.gl.uniform1f(p.uniform('u_white'), white);
        gpu.gl.uniform1f(p.uniform('u_gamma'), gamma);
      }),

    gradientMap: async (input, stops) =>
      !usable(input) || stops.length === 0 || stops.length > 8
      ? cpuKernels.gradientMap(input, stops)
      : run(gpu, input, gpu.programs.gradientMap, p => {
        gpu.gl.uniform3fv(p.uniform('u_stops'), new Float32Array(stops.flat()));
        gpu.gl.uniform1i(p.uniform('u_count'), stops.length);
      }),

    posterize: async (input, levels) =>
      !usable(input)
      ? cpuKernels.posterize(input, levels)
      : run(gpu, input, gpu.programs.posterize, p => gpu.gl.uniform1f(p.uniform('u_levels'), levels)),

    orderedDither: async (input, matrixSize, levels, monochrome, pixelSize) =>
      !usable(input) || matrixSize > 8
      ? cpuKernels.orderedDither(input, matrixSize, levels, monochrome, pixelSize)
      : run(gpu, input, gpu.programs.orderedDither, p => {
        gpu.gl.uniform1fv(p.uniform('u_bayer'), new Float32Array(bayerMatrix(matrixSize)));
        gpu.gl.uniform1i(p.uniform('u_n'), matrixSize);
        gpu.gl.uniform1f(p.uniform('u_levels'), levels);
        gpu.gl.uniform1i(p.uniform('u_mono'), monochrome ? 1 : 0);
        gpu.gl.uniform1i(p.uniform('u_pixelSize'), Math.max(1, Math.round(pixelSize)));
      }),

    edges: async (input, strength, threshold, invert) =>
      !usable(input)
      ? cpuKernels.edges(input, strength, threshold, invert)
      : run(gpu, input, gpu.programs.edges, p => {
        gpu.gl.uniform1f(p.uniform('u_strength'), strength);
        gpu.gl.uniform1f(p.uniform('u_threshold'), threshold);
        gpu.gl.uniform1i(p.uniform('u_invert'), invert ? 1 : 0);
      }),

    colorKey: async (input, key, tolerance, softness) =>
      !usable(input)
      ? cpuKernels.colorKey(input, key, tolerance, softness)
      : run(gpu, input, gpu.programs.colorKey, p => {
        gpu.gl.uniform3f(p.uniform('u_key'), ...key);
        gpu.gl.uniform1f(p.uniform('u_tolerance'), tolerance);
        gpu.gl.uniform1f(p.uniform('u_softness'), softness);
      }),

    amHalftone: async (blurred, screen: HalftoneScreen) => {
      if (!usable(blurred)) {
        return cpuKernels.amHalftone(blurred, screen);
      }
      const width = Math.max(1, Math.round(blurred.width * screen.scale));
      const height = Math.max(1, Math.round(blurred.height * screen.scale));
      return run(gpu, blurred, gpu.programs.halftone, p => {
        gpu.gl.uniform2f(p.uniform('u_outSize'), width, height);
        gpu.gl.uniform1f(p.uniform('u_scale'), screen.scale);
        gpu.gl.uniform1f(p.uniform('u_cell'), screen.cell);
        gpu.gl.uniform1f(p.uniform('u_angle'), screen.angle);
        gpu.gl.uniform1i(p.uniform('u_shape'), dotShapeIndex(screen.shape));
        gpu.gl.uniform1i(p.uniform('u_invert'), screen.invert ? 1 : 0);
        gpu.gl.uniform1fv(p.uniform('u_lut'), toneTable(screen.shape));
      }, { width, height, linear: true });
    },

    cmykChannels: async (input, mode) =>
      !usable(input)
      ? cpuKernels.cmykChannels(input, mode)
      : [0, 1, 2, 3].map(channel =>
        run(gpu, input, gpu.programs.cmyk, p => {
          gpu.gl.uniform1i(p.uniform('u_channel'), channel);
          gpu.gl.uniform1i(p.uniform('u_amount'), mode === 'amount' ? 1 : 0);
          gpu.gl.uniform3f(p.uniform('u_ink'), ...inks[channel]);
        })),

    rgbChannels: async (input) =>
      !usable(input)
      ? cpuKernels.rgbChannels(input)
      : [0, 1, 2].map(channel =>
        run(gpu, input, gpu.programs.rgbChannels, p => gpu.gl.uniform1i(p.uniform('u_channel'), channel))),
  };
};
