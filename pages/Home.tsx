import { ButtonCounter } from '../components/ButtonCounter';
import { JSX } from 'react/jsx-runtime';

export const Home = (): JSX.Element => {
	const onChildClicked = (e: number) => {
		console.warn('callback from parent triggered', e);
	};

	return (
		<>
			<h1>AgriNexus workspace</h1>
			<p>Operational AI tools for agri trade teams.</p>
			<ul>
				<li>Marketplace signals</li>
				<li>Client dossiers</li>
				<li>AI assisted deal review</li>
			</ul>

			<ButtonCounter
				className="mt-3"
				name={'Demo action'}
				onClicked={e => onChildClicked(e)}
			/>
		</>
	);
};
