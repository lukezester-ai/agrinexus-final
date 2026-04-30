import React from 'react';
import { ButtonCounter } from '../components/ButtonCounter';
import { JSX } from 'react/jsx-runtime';

export const Home = (): JSX.Element => {
	const onChildClicked = (e: number) => {
		console.warn('callback from parent triggered', e);
	};

	return (
		<>
			<h6>contains:</h6>
			<ul>
				<li>React v19</li>
				<li>React Router DOM v6.3 with Routing Setup</li>
				<li>Basic Functional Component</li>
				<li>ButtonCounter with Hooks</li>
				<li>TSX / Typescript Support</li>
				<li>Twitter Bootstrap v5</li>
			</ul>

			<ButtonCounter
				className="mt-3"
				name={'Hello React Button'}
				onClicked={e => onChildClicked(e)}
			/>

			<small className="mt-5 d-block">
				coded by{' '}
				<a target="blank" href="https://github.com/oardi">
					Ardian Shala
				</a>
			</small>
		</>
	);
};
