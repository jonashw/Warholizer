import React from "react";

const OffCanvas = ({
	title,
	open,
	setOpen,
	children,
	style
} : {
	title: string,
	open: boolean,
	setOpen: (o: boolean) => void,
	children: React.ReactNode,
	style?: React.CSSProperties
}) => {
	return <div className={"offcanvas offcanvas-start" + (open ? " show" : "")}
		style={{...(style || {}), ...(open ? {visibility: 'visible'} : {})}}
		tabIndex={-1}
		aria-labelledby="settings-offcanvas"
	>
		<div className="offcanvas-header">
			<h5 className="offcanvas-title" id="settings-offcanvas">{title}</h5>
			<button type="button" className="btn-close" aria-label="Close" onClick={() => setOpen(false)}></button>
		</div>
		<div className="offcanvas-body">
			{children}
		</div>
	</div>;
}

export default OffCanvas;