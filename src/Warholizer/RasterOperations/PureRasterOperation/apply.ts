import { applyTone } from "./tone";
import { Halftone, Line, PaperSizeById, PureRasterOperation, Resolved, SlideWrap, Tile } from "./types";
import { defaultDpi, resolveLengths } from "./length";
import { PixelKernels, cpuKernels, inks } from "./kernels";
import { RGB, medianCutPalette, paintColors, parseHexColor, toHexColor } from "./palette";
import { borderColor, connectedColorKey, errorDiffusion, stickerBorder } from "./sequential";
import { angle } from "../../../NumberTypes";



const slideWrap = async (input: OffscreenCanvas, op: SlideWrap): Promise<OffscreenCanvas> => {
  return offscreenCanvasOperation(input.width, input.height,(ctx) => {
    const wrapCoefficient = op.amount/100;
    if(op.dimension === 'x'){
      const x = input.width * wrapCoefficient;
      const xx = input.width - x;
      ctx.drawImage(input,x,0);
      ctx.drawImage(input,-xx,0);
    }
    if(op.dimension === 'y'){
      const y = input.height * wrapCoefficient;
      const yy = input.height - y;
      ctx.drawImage(input,0,-y);
      ctx.drawImage(input,0,yy);
    }
  });
};

const line = async (inputs: OffscreenCanvas[], op: Line): Promise<OffscreenCanvas> => {
  const horizontal = op.direction === "left" || op.direction === "right";
  const [width,height] = 
    horizontal
    ? [
      op.squish ? (inputs[0]?.width ?? 0) : inputs.map(i => i.width).reduce((a,b) => a + b, 0),
      Math.max(...inputs.map(i => i.height))
    ] : [
      Math.max(...inputs.map(i => i.width)),
      op.squish ? (inputs[0]?.height ?? 0) : inputs.map(i => i.height).reduce((a,b) => a + b, 0)
    ];
  const orderedInputs = 
    op.direction === "up" || op.direction === "left"
    ? [...inputs].reverse()
    : inputs;
    
  return await offscreenCanvasOperation(width, height, (ctx) => {
    if(op.squish){
      const scale = {
        x: horizontal ? 1/inputs.length : 1,
        y:!horizontal ? 1/inputs.length : 1
      };
      ctx.scale(scale.x,scale.y);
    }
    for(const input of orderedInputs){
      ctx.drawImage(input,0,0);
      const [w,h] = op.squish ? [width,height] : [input.width, input.height];
      ctx.translate(
          horizontal ? w : 0,
        !horizontal ? h : 0
      );
    }
  });
}

/**
 * Builds `apply` around a set of pixel kernels. Composition (layout, geometry, compositing) is
 * shared Canvas 2D code; only the per-pixel loops differ between CPU and GPU implementations.
 */
const createApply = (kernels: PixelKernels) => {
/** The original halftone: a rotated pattern of fixed dots, color-burned and thresholded (style 'classic'). */
const classicHalftone = async (input: OffscreenCanvas, op: Resolved<Halftone>): Promise<OffscreenCanvas> => {
        const patternSpacingRatio = 2;
        const patternSideLength = op.dotDiameter * patternSpacingRatio;
        const patternImage = await offscreenCanvasOperation(patternSideLength, patternSideLength, (ctx) => {
          ctx.fillStyle = "white";
          ctx.fillRect(0,0,patternSideLength,patternSideLength);

          ctx.fillStyle = "black";
          const s = patternSideLength;
          const h = s/2;
          for(const [x,y] of [ [h,h], [0,0], [0,s], [s,0], [s,s] ]){
            ctx.beginPath();
            ctx.arc(x,y,op.dotDiameter/2,0,Math.PI*2);
            ctx.fill();
          }
        });
        const patternAreaW = input.width*patternSpacingRatio;
        const patternAreaH = input.height*patternSpacingRatio;
        const dotsImage = await offscreenCanvasOperation(patternAreaW,patternAreaH,(ctx) => {
          //this image is bigger than it needs to be to account for rotation.
          const w = patternAreaW;
          const h = patternAreaH;
          ctx.fillStyle = ctx.createPattern(patternImage,'repeat')!;
          ctx.translate(w/2,h/2);
          ctx.rotate(op.angle * Math.PI / 180);
          ctx.translate(-w/2,-h/2);
          ctx.fillRect(0,0,w,h);
        });
        if(op.dotsOnly){
          return offscreenCanvasOperation(input.width,input.height,(ctx) => {
            ctx.translate(-input.width/2,-input.height/2);
            ctx.drawImage(dotsImage,0,0);
          });
        }
        const halftoned = await offscreenCanvasOperation(input.width,input.height,(ctx) => {
          ctx.save();
          ctx.fillRect(0,0,input.width,input.height);
          ctx.filter=`grayscale(100%)`;
          if(op.invert){
            ctx.filter+=" invert()";
          }
          ctx.drawImage(input,0,0); 
          ctx.filter=`blur(${op.blurPixels}px)`;
          ctx.fillStyle='black';
          ctx.globalCompositeOperation = 'color-burn';
          ctx.translate(-input.width/2,-input.height/2); //use the good parts of the dots image
          ctx.drawImage(dotsImage,0,0);
          ctx.restore();
        }).then(burned => kernels.threshold(burned, 1));
        if(!op.invert){
          return halftoned;
        }

        return offscreenCanvasOperation(input.width,input.height,(ctx) => {
           ctx.filter="invert()";
           ctx.drawImage(halftoned,0,0);
          });
      };

/** AM screen halftone (style 'smooth'): each cell's dot is sized by the cell's mean tone. */
const smoothHalftone = async (input: OffscreenCanvas, op: Resolved<Halftone>): Promise<OffscreenCanvas> => {
  const cell = Math.max(1, op.dotDiameter);
  // Optional extra softening; the screen itself averages each cell's tone.
  const blurred = op.blurPixels > 0
    ? await offscreenCanvasOperation(input.width, input.height, ctx => {
      ctx.filter = `blur(${op.blurPixels}px)`;
      ctx.drawImage(input, 0, 0);
    })
    : input;
  return kernels.amHalftone(blurred, {
    cell,
    angle: op.angle,
    shape: op.shape ?? 'round',
    invert: !!op.invert,
    scale: Math.min(8, Math.max(1, op.scale ?? 1)),
  });
};

/** Every input, downscaled side by side on one canvas: a sample for statistics across a group. */
const sampleSheet = (inputs: OffscreenCanvas[], side = 128): OffscreenCanvas => {
  const scaled = inputs.map(input => {
    const s = Math.min(1, side / Math.max(1, input.width, input.height));
    return [Math.max(1, Math.round(input.width * s)), Math.max(1, Math.round(input.height * s))] as const;
  });
  const sheet = new OffscreenCanvas(scaled.reduce((a, [w]) => a + w, 0), Math.max(...scaled.map(([, h]) => h)));
  const ctx = sheet.getContext('2d')!;
  let x = 0;
  inputs.forEach((input, i) => { ctx.drawImage(input, x, 0, scaled[i][0], scaled[i][1]); x += scaled[i][0]; });
  return sheet;
};

const applyOp = async (unresolved: PureRasterOperation, inputs: OffscreenCanvas[]): Promise<OffscreenCanvas[]> => {
  // Sizes arrive resolved from Composer; anything else is measured against the first input at full scale.
  const first = inputs[0];
  const op = resolveLengths(unresolved, { dpi: defaultDpi, scale: 1, shortSide: first ? Math.min(first.width, first.height) : 0 });
  const opType = op.type;
  switch(opType){
    case 'printSet': 
      return Promise.all(inputs.map(async input => {
        const wholeRowsOnly = false;
        const paper = PaperSizeById[op.paperSize]; 
        const w = input.width * op.rowLength;
        const ar = op.orientation === 'portrait' ? paper.AR : 1 / paper.AR;
        const h = w / ar; 
        const tileWidth = Math.floor(w / op.rowLength);
        const tileAR = (input.width / input.height);
        const tileHeight = tileWidth / tileAR;
        const rowsThatWillFitAtLeastPartially = Math.ceil(h / tileHeight);
        return offscreenCanvasOperation(w, h, async (ctx) => {
          const patternImage = await (async () => { switch(op.tilingPattern){
            case 'normal': {
              return Promise.resolve(input);
            }
            case 'half-drop': {
              return line([
                input,
                await slideWrap(input, {type:'slideWrap',dimension:'y',amount:50})
              ], {type:'line',direction:'right',squish:false})
            }
            case 'half-brick': {
              return line([
                input,
                await slideWrap(input, {type:'slideWrap',dimension:'x',amount:50})
              ], {type:'line',direction:'down',squish:false})
            }
            case 'wacky': {
              const wrapped = await slideWrap(input, {type:'slideWrap',dimension:'x',amount:50});
              return line([
                await line([
                  input,
                  await flipped(input,true,false)
                ], {type:'line',direction:'right',squish:false}),
                await line([
                  wrapped,
                  await flipped(wrapped,true,false)
                ], {type:'line',direction:'right',squish:false}),
              ], {type:'line',direction:'down',squish:false})
            }
            case 'mirror': {
              return tile([
                input,
                await flipped(input,true,false),
                await flipped(input,false,true),
                await flipped(input,true,true),
              ], {type:'tile',primaryDimension:'x',lineLength:2});
            }
            default: {
              console.error(new Error(`Tiling pattern not yet implemented: ${op.tilingPattern}`));
              return Promise.resolve(input);
            }
          }})();

          ctx.fillStyle = ctx.createPattern(patternImage,'repeat')!;

          if(wholeRowsOnly){
            ctx.fillRect(
              0,0,
              w, (rowsThatWillFitAtLeastPartially-1) * tileHeight);
          } else {
            ctx.fillRect(
              0,0, 
              w, h);
          }
        });
      }));
    case 'halftone':
      return Promise.all(inputs.map(input => op.style === 'classic' ? classicHalftone(input, op) : smoothHalftone(input, op)));
    case 'stack':
      {
        if(inputs.length === 0){
          return inputs;
        }
        const inp = inputs[0];
        return offscreenCanvasOperation(inp.width, inp.height, (ctx) => {
          ctx.globalCompositeOperation = op.blendingMode;
          for(const inp of inputs){
            ctx.drawImage(inp,0,0);
          }
        }).then(osc => [osc]);
      }
    case 'void': 
      return [];
    case 'noop': 
      return inputs;
    case 'copies': 
      return Array(op.n).fill(inputs).flatMap(inputs => inputs);
    case 'fill':
      return Promise.all(inputs.map(input => {
        return offscreenCanvasOperation(input.width,input.height,(ctx) => {
          ctx.globalCompositeOperation=op.blendingMode;
          ctx.fillStyle=op.color ?? "#000000";
          ctx.drawImage(input,0,0);
          ctx.fillRect(0,0,input.width,input.height);
        });
      }));
    case 'crop': 
      return Promise.all(inputs.map(input => {
        const [x,y,w,h] =
          op.unit === "px" 
          ? [op.x, op.y, op.width, op.height] 
          : [
            input.width * op.x / 100,
            input.height * op.y / 100,
            input.width * op.width / 100,
            input.height * op.height / 100
          ];
        return offscreenCanvasOperation(w,h,(ctx) => {
          ctx.drawImage(
            input,
            x, //sx
            y, //sy
            w, //sw
            h,//sh
            0,//dx
            0,//dy
            w,//dw
            h//dh
          );
        });
      }));
    case 'threshold': 
      return Promise.all(inputs.map(input => kernels.threshold(input, op.value)));
    case 'noise':
      return Promise.all(inputs.map(input => kernels.noise(input, op)));
    case 'quantize': {
      const shared = op.palette === 'shared' && inputs.length > 1 ? medianCutPalette(sampleSheet(inputs), op.colors) : undefined;
      return Promise.all(inputs.map(input => {
        const palette = shared ?? medianCutPalette(input, op.colors);
        return kernels.mapToPalette(input, palette, paintColors(palette, op.replacements));
      }));
    }
    case 'separateColors':
      return (await Promise.all(inputs.map(input => {
        const palette = medianCutPalette(input, op.colors);
        const paint = paintColors(palette, op.replacements);
        return Promise.all(palette.map((_, i) => kernels.mapToPalette(input, palette, paint, i)));
      }))).flat();
    case 'gradientMap': {
      const stops = op.stops.map(parseHexColor).filter((c): c is RGB => c !== undefined);
      return Promise.all(inputs.map(input => kernels.gradientMap(input, stops)));
    }
    case 'posterize':
      return Promise.all(inputs.map(input => kernels.posterize(input, Math.max(2, op.levels))));
    case 'orderedDither':
      return Promise.all(inputs.map(input =>
        kernels.orderedDither(input, op.matrixSize, Math.max(2, op.levels), op.monochrome, Math.max(1, op.pixelSize))));
    case 'errorDiffusion':
      return inputs.map(input => errorDiffusion(input, op.method, Math.max(2, op.levels), op.monochrome));
    case 'dither': {
      const { method } = op;
      return method.type === 'ordered'
        ? applyOp({ type: 'orderedDither', matrixSize: method.matrixSize, pixelSize: method.pixelSize, levels: op.levels, monochrome: op.monochrome }, inputs)
        : applyOp({ type: 'errorDiffusion', method: method.algorithm, levels: op.levels, monochrome: op.monochrome }, inputs);
    }
    case 'edges':
      return Promise.all(inputs.map(input => kernels.edges(input, op.strength, op.threshold, op.invert)));
    case 'stickerBorder':
      return inputs.map(input => stickerBorder(input, Math.max(0, op.width), parseHexColor(op.color) ?? [255, 255, 255], op.cutLine));
    case 'colorKey':
      return Promise.all(inputs.map(input => {
        if (input.width === 0 || input.height === 0) {
          return kernels.colorKey(input, [0, 0, 0], op.tolerance, op.softness);
        }
        const key = parseHexColor(op.color) ?? borderColor(input);
        return op.connected
          ? connectedColorKey(input, key, op.tolerance, op.softness)
          : kernels.colorKey(input, key, op.tolerance, op.softness);
      }));
    case 'cmykChannels':
      return (await Promise.all(inputs.map(input => kernels.cmykChannels(input, 'ink')))).flat();
    case 'colorHalftone':
      return Promise.all(inputs.map(async input => {
        // Traditional screen angles keep the four dot grids from forming moiré.
        const angles = [15, 75, 0, 45];
        const scale = Math.min(8, Math.max(1, op.scale ?? 1));
        const [w, h] = [Math.max(1, Math.round(input.width * scale)), Math.max(1, Math.round(input.height * scale))];
        const amounts = await kernels.cmykChannels(input, 'amount');
        const layers = await Promise.all(amounts.map(async (amount, k) => {
          const [dots] = await applyOp({ type: 'halftone', angle: angle(angles[k]), dotDiameter: op.dotDiameter, blurPixels: op.blurPixels, invert: false, shape: op.shape, scale }, [amount]);
          // Black dots become ink; white stays white; anti-aliased edges blend toward ink.
          return offscreenCanvasOperation(w, h, ctx => {
            ctx.drawImage(dots, 0, 0);
            ctx.globalCompositeOperation = 'lighten';
            ctx.fillStyle = toHexColor(inks[k]);
            ctx.fillRect(0, 0, w, h);
          });
        }));
        return offscreenCanvasOperation(w, h, ctx => {
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, w, h);
          ctx.globalCompositeOperation = 'multiply';
          layers.forEach(layer => ctx.drawImage(layer, 0, 0));
          // Keep the input's transparency.
          ctx.globalCompositeOperation = 'destination-in';
          ctx.drawImage(input, 0, 0, w, h);
        });
      }));
    case 'levels':
      return Promise.all(inputs.map(input => kernels.levels(input, op.black, op.white, op.gamma)));
    case 'tone':
      return applyTone(op, inputs);
    case 'rgbChannels': 
      return (await Promise.all(inputs.map(input => kernels.rgbChannels(input)))).flat();
    case 'grayscale': 
      return Promise.all(inputs.map(input =>
        offscreenCanvasOperation(input.width, input.height,(ctx) => {
          ctx.filter=`grayscale(${op.percent}%)`
          ctx.drawImage(input,0,0);
        })));
    case 'rotateHue': 
      return Promise.all(inputs.map(input =>
        offscreenCanvasOperation(input.width, input.height,(ctx) => {
          ctx.filter=`hue-rotate(${op.degrees}deg)`
          ctx.drawImage(input,0,0);
        })));
    case 'blur': 
      return Promise.all(inputs.map(input =>
        offscreenCanvasOperation(input.width, input.height,(ctx) => {
          ctx.filter=`blur(${op.pixels}px)`
          ctx.drawImage(input,0,0);
        })));
    case 'invert': 
      return Promise.all(inputs.map(input =>
        offscreenCanvasOperation(input.width, input.height,(ctx) => {
          ctx.filter="invert()";
          ctx.drawImage(input,0,0);
        })));
    case 'split': {
      const proportions = [
        (op.amount)/100,
        (100-op.amount)/100
      ];
      return Promise.all(inputs.flatMap(input =>
        proportions.map((proportion,i) => {
          const [w,h,sx,sy] = 
            op.dimension === 'x' 
            ? [input.width * proportion, input.height,  i===0 ? 0 : input.width * (1-proportion),0]
            : [input.width, input.height * proportion,0,i===0 ? 0 : input.height * (1-proportion)];
          return offscreenCanvasOperation(w, h, (ctx) => {
            ctx.translate(-sx,-sy);
            ctx.drawImage(input, 0, 0);
          });
        })));
      }
    case 'slideWrap': 
      return Promise.all(inputs.map(input => slideWrap(input, op)));
    case 'scaleToFit':
      return Promise.all(inputs.map(input => {
        const ar = input.width / input.height;
        const wr = op.w / input.width;
        const hr = op.h / input.height;

        const [scaleFactor,width,height] = 
          op.w > input.width && op.h > input.height
          ? [1,input.width,input.height] //do not scale up
          : wr < hr
          ? [wr,op.w,op.w / ar] //width drive
          : [hr,op.h * ar,op.h];
        return offscreenCanvasOperation(width, height, (ctx) => {
          ctx.scale(scaleFactor,scaleFactor);
          ctx.drawImage(input,0,0);
        });
      }));
    case 'rotate':
      return Promise.all(inputs.map(input => {
        const dimensionSwitch = op.degrees === 90 || op.degrees === 270;
        const [width,height] =
          dimensionSwitch
          ? [input.height,input.width]
          : [input.width,input.height];
        // Quarter turns fit exactly in the swapped canvas; only other angles need shrinking to stay in frame.
        const scaleToRetainFullImage = op.degrees % 90 !== 0;
        return offscreenCanvasOperation(width, height, (ctx) => {
          const radians = op.degrees * Math.PI / 180;
          const rotationCenter = 
              op.about === "top-left"
            ? {x:0,y:0}
            : op.about === "top-right"
            ? {x: width, y: 0}
            : op.about === "bottom-left"
            ? {x: 0, y: height}
            : op.about === "bottom-right"
            ? {x: width, y: height}
            : {x: width/2, y: height/2};
          ctx.translate(rotationCenter.x, rotationCenter.y);
          if(scaleToRetainFullImage){
            //reference: https://stackoverflow.com/questions/6657479/aabb-of-rotated-sprite
            const aabb = {
              h: width * Math.abs(Math.sin(radians)) + height * Math.abs(Math.cos(radians)),
              w: height * Math.abs(Math.sin(radians)) + width * Math.abs(Math.cos(radians))
            };
            const scale = {
              x: width/aabb.w,
              y: height/aabb.h
            };
            ctx.scale(scale.x,scale.y);
          }
          ctx.rotate(radians);
          if(dimensionSwitch){
            ctx.translate(-rotationCenter.y, -rotationCenter.x);
          } else {
            ctx.translate(-rotationCenter.x, -rotationCenter.y);
          }
          ctx.drawImage(input,0,0);
        });
      }));
    case 'scale':
      return Promise.all(inputs.map(input => {
        const scaleWidth = Math.abs(op.x) * input.width;
        const scaleHeight = Math.abs(op.y) * input.height;
        return offscreenCanvasOperation(scaleWidth, scaleHeight, (ctx) => {
          if(op.x < 0){
            ctx.translate(scaleWidth,0);
          }
          if(op.y < 0){
            ctx.translate(0,scaleHeight);
          }
          ctx.scale(op.x, op.y);
          ctx.drawImage(input,0,0);
        });
      }));
    case 'grid': return Promise.all(inputs.map(input => {
      if(op.cols <= 0 || op.rows <= 0){
        return input;
      }
      return offscreenCanvasOperation(op.cols * input.width, op.rows * input.height, (ctx) => {
        for(let r = 0; r < op.rows; r++){
          ctx.save();
          for(let c = 0; c < op.cols; c++){
            ctx.drawImage(input,0,0);
            ctx.translate(input.width,0);
          }
          ctx.restore();
          ctx.translate(0,input.height);
        }
      });
    }));
    case 'tile': return inputs.length === 0 ? [] : [await tile(inputs, op)];
    case 'line': return inputs.length === 0 ? [] : [await line(inputs, op)];
    default:
      throw new Error(`Unexpected operation type: ${opType}`);
  }
};
return applyOp;
};

const flipped = (input: OffscreenCanvas, flipX: boolean, flipY: boolean): Promise<OffscreenCanvas> => {
  return offscreenCanvasOperation(input.width, input.height, (ctx) => {
    const scaleX = flipX ? -1 : 1;
    const scaleY = flipY ? -1 : 1;
    ctx.scale(scaleX,scaleY);
    ctx.drawImage(
      input,
      flipX?-input.width:0,
      flipY?-input.height:0);
    ctx.scale(scaleX,scaleY);
  });
};

const tile = async (inputs: OffscreenCanvas[], op: Tile): Promise<OffscreenCanvas> => {
  if(op.lineLength <= 0){
    return new OffscreenCanvas(0,0);
  }
  const lineCount = Math.ceil(inputs.length / op.lineLength);
  const lines = 
    Array(lineCount)
    .fill(undefined)
    .map((_,i) => {
      const lineInputs = inputs.slice(i*op.lineLength,(i+1)*op.lineLength);
      const [width,height] = 
      op.primaryDimension === "x"
      ?  [
        lineInputs.map(i => i.width).reduce((a,b) => a + b, 0),
        Math.max(...lineInputs.map(i => i.height))
      ] : [
        Math.max(...lineInputs.map(i => i.width)),
        lineInputs.map(i => i.height).reduce((a,b) => a + b, 0)
      ];
      return {
        inputs: lineInputs,
        width,
        height
      };
    });

  const [width,height] = 
    op.primaryDimension === "x"
    ? [
      Math.max(...lines.map(l => l.width)),
      lines.map(l => l.height).reduce((a,b) => a + b, 0)
    ] : [
      lines.map(l => l.width).reduce((a,b) => a + b, 0),
      Math.max(...lines.map(l => l.height))
    ];
    
  return await offscreenCanvasOperation(width, height, (ctx) => {
    for(const line of lines){
      ctx.save();
      for(const input of line.inputs){
        ctx.drawImage(input,0,0);

        if(op.primaryDimension === "x"){
          ctx.translate(input.width,0);
        } else {
          ctx.translate(0,input.height);
        }
      }
      ctx.restore();
      if(op.primaryDimension === "x"){
        ctx.translate(0,line.height);
      } else {
        ctx.translate(line.width,0);
      }
    }
  });
};

async function offscreenCanvasOperation(
  width: number,
  height: number,
  action: (ctx: OffscreenCanvasRenderingContext2D) => void | Promise<void>
): Promise<OffscreenCanvas> {
  const c = new OffscreenCanvas(width,height);
  const ctx = c.getContext('2d')!;
  // Await async actions (e.g. printSet builds its pattern asynchronously); otherwise the
  // canvas would be returned before it is drawn.
  await action(ctx);
  return c;
}



/** Reference implementation: Canvas 2D with JavaScript pixel loops. */
const apply = createApply(cpuKernels);

const applyFlatMap = async (ops: PureRasterOperation[], inputs: OffscreenCanvas[]): Promise<OffscreenCanvas[]> => {
  return (await Promise.all(ops.flatMap(op => apply(op, inputs)))).flatMap(d => d);
};

const applyPipeline = async (ops: PureRasterOperation[], inputs: OffscreenCanvas[]): Promise<OffscreenCanvas[]> => {
  const pipeds = await Promise.all(inputs.flatMap(input => {
    const piped = ops.reduce(
      async (oscs,op) => apply(op, await oscs),
      Promise.resolve([input]));
    return piped;
  }));
  return pipeds.flatMap(p => p);
};

export {apply, applyPipeline, applyFlatMap, createApply, offscreenCanvasOperation};