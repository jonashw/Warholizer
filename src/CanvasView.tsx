import React from "react";

/**
 * Shows an OffscreenCanvas by copying it into an on-screen <canvas>. Much cheaper than encoding
 * a data URL, which matters when a gallery re-renders many images per interaction.
 */
export function CanvasView({
  osc, className, style, title
}: {
  osc: OffscreenCanvas,
  className?: string,
  style?: React.CSSProperties,
  title?: string
}) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) {
      return;
    }
    canvas.width = osc.width;
    canvas.height = osc.height;
    if (osc.width > 0 && osc.height > 0) {
      canvas.getContext('2d')!.drawImage(osc, 0, 0);
    }
  }, [osc]);
  return <canvas ref={ref} className={className} style={style} title={title} />;
}
