const FloatingActionButton = ({
	i,
	disabled,
	onClick,
	className,
	children
} : {
	i?: number,
	disabled?: boolean | undefined;
	onClick: () => void;
	className: string;
	children: React.ReactNode;
}) => 
	<button
		className={(className || "") + " fab"}
		disabled={disabled}
		onClick={() => onClick()}
		style={{
			position: 'fixed',
			boxShadow: '0px 5px 5px rgba(0,0,0,0.25)',
			zIndex:1000,
			bottom: `${(1+5*(i||0))}em`,
			right: '1em',
			borderRadius: '50%',
			width: '4em',
			height: '4em'
		}}
	>
		{children}
	</button>;

export default FloatingActionButton;