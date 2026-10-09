import React from "react";
import { playOrder } from "../export/gif";

/** Plays animation frames on a canvas. */
export function AnimatedView({ frames, frameMs, bounce, className }: { frames: OffscreenCanvas[], frameMs: number, bounce: boolean, className?: string }) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    const canvas = ref.current;
    const order = playOrder(frames, bounce);
    if (!canvas || order.length === 0) return;
    canvas.width = order[0].width;
    canvas.height = order[0].height;
    const ctx = canvas.getContext('2d')!;
    let i = 0;
    const draw = () => { ctx.drawImage(order[i % order.length], 0, 0); i++; };
    draw();
    const timer = window.setInterval(draw, Math.max(20, frameMs));
    return () => window.clearInterval(timer);
  }, [frames, frameMs, bounce]);
  return <canvas ref={ref} className={className} />;
}
