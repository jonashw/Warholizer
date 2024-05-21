import React from 'react';

type MetaKeyHeldState = {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
};

function stateEqual(a: MetaKeyHeldState, b: MetaKeyHeldState){
  return a.alt === b.alt && a.shift === b.shift && a.ctrl === b.ctrl;
}

export function useMetaKeys() {
  const [state, setState] = React.useState<MetaKeyHeldState>({ ctrl: false, shift: false, alt: false });

  React.useEffect(() => {
    function handler(e: KeyboardEvent) {
      const nextState = { alt: e.altKey, shift: e.shiftKey, ctrl: e.ctrlKey };
      if (!stateEqual(state, nextState)) {
        setState(nextState);
        console.log(nextState);
      }
    }
    window.addEventListener('keydown', handler);
    window.addEventListener('keyup', handler);
    return () => {//cleanup
      window.removeEventListener('keydown', handler);
      window.removeEventListener('keyup', handler);
    };
  }, [state]);

  return state;
}