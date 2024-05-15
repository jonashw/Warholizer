import React from "react";
import './Modal.css';

export function Modal<T>({
  title, onClose, 
  flush,
  body, footer, isStatic, noHeader
}: {
  title: string;
  onClose?: (value?: T) => void;
  flush?: boolean;
  body: React.ReactElement;
  footer?: React.ReactElement;
  isStatic?: boolean;
  noHeader?: boolean;
}) {

  const cancel = React.useCallback(() => {
    if (onClose) {
      onClose(undefined);
    }
  },[onClose]);

  const cancelImplicitly = React.useCallback(() => {
    if (isStatic) {
      return;
    }
    cancel();
  },[cancel, isStatic]);

  React.useEffect(() => {
    document.onkeydown = e => {
      console.log(e);
      if(e.key === "Escape"){
        cancelImplicitly();
      }
    }
    return () => {
      document.onkeydown = null;
    };
  },[cancelImplicitly]);

  return <>
    <div
      className={"modal fade show" + (flush ? " modal-flush" : "")}
      tabIndex={-1}
      onClick={cancelImplicitly}
    >
      <div className="modal-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-content">
          {!noHeader && (
            <div className="modal-header">
              <h5 className="modal-title">{title}</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={cancel}></button>
            </div>
          )}
          <div className="modal-body">
            {body}
          </div>
          {footer && <div className="modal-footer">{footer}</div>}
        </div>
      </div>
    </div>
    <div className="modal-backdrop fade show"></div>
  </>;
}
