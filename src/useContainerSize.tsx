import React, { Ref } from 'react';


export const useContainerSize = (): { containerRef: Ref<HTMLDivElement>; clientRect: DOMRect; } => {
  const containerRef = React.createRef<HTMLDivElement>();
  const [clientRect, setClientRect] = React.useState<DOMRect>(new DOMRect(0, 0, 0, 0));
  React.useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    const container = containerRef.current!;
    const update = () => {
      setClientRect(container.getBoundingClientRect());
    };

    window.addEventListener('resize', update);
    update();
    return () => {
      window.removeEventListener('resize', update);
    };
  }, [containerRef]);
  return { clientRect, containerRef };
};
