import React, { ComponentProps, ReactElement, useMemo, useState } from 'react';

interface IButtonCounterProps extends ComponentProps<'button'> {
	name: string;
	onClicked?: (e: number) => void;
}

export const ButtonCounter = (props: IButtonCounterProps): ReactElement => {
	const { name, onClicked, className, ...rest } = props;
	const [count, setCount] = useState<number>(0);

	const cssClasses: string = useMemo(() => {
		const classes: string[] = ['btn', 'btn-primary'];
		if (className) {
			classes.push(className);
		}
		return classes.join(' ');
	}, [className]);

	const handleClick = () => {
		const result = count + 1;
		setCount(result);
		onClicked && onClicked(result);
	};

	return (
		<button type="button" onClick={handleClick} className={cssClasses} {...rest}>
			{name} - You clicked me {count} times
		</button>
	);
};
