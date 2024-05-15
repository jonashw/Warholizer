import React from "react";


export function Modal<T>({
  title, onClose, body, footer
}: {
  title: string;
  onClose?: (value?: T) => void;
  body: React.ReactElement;
  footer?: React.ReactElement;
}) {
  const cancel = () => {
    if (onClose) {
      onClose(undefined);
    }
  };
  return <>
    <div className="modal fade show" tabIndex={-1} style={{ display: 'block' }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{title}</h5>
            <button type="button" className="btn-close" aria-label="Close" onClick={cancel}></button>
          </div>
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
