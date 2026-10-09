import { PixelKernels, cpuKernels } from "../kernels";

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
// Input pixel for this fragment in 0..255 straight alpha. Canvas rows run top-down; GL's run bottom-up.
vec4 inputPixel() {
  ivec2 p = ivec2(int(gl_FragCoord.x), u_size.y - 1 - int(gl_FragCoord.y));
  return texelFetch(u_input, p, 0) * 255.0;
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
  programs: { threshold: Program, rgbChannels: Program, noise: Program },
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
    },
    lost: false,
  };
  canvas.addEventListener('webglcontextlost', () => { ctx.lost = true; });
  return ctx;
};

/** Uploads `input`, runs `program` over it, and returns the result as a new 2D canvas. */
const run = (
  ctx: GpuContext,
  input: OffscreenCanvas,
  program: Program,
  setUniforms: (p: Program) => void
): OffscreenCanvas => {
  const { gl, canvas } = ctx;
  const { width, height } = input;
  canvas.width = width;
  canvas.height = height;
  gl.viewport(0, 0, width, height);
  gl.bindTexture(gl.TEXTURE_2D, ctx.texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, input);
  gl.useProgram(program.program);
  gl.uniform1i(program.uniform('u_input'), 0);
  gl.uniform2i(program.uniform('u_size'), width, height);
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

    rgbChannels: async (input) =>
      !usable(input)
      ? cpuKernels.rgbChannels(input)
      : [0, 1, 2].map(channel =>
        run(gpu, input, gpu.programs.rgbChannels, p => gpu.gl.uniform1i(p.uniform('u_channel'), channel))),
  };
};
