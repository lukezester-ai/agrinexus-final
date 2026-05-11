import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

class ErrorBoundary extends React.Component<
	{ children: React.ReactNode },
	{ err: Error | null }
> {
	constructor(props: { children: React.ReactNode }) {
		super(props);
		this.state = { err: null };
	}

	static getDerivedStateFromError(err: Error) {
		return { err };
	}

	componentDidCatch(err: Error) {
		console.error('[SIMA]', err);
	}

	render() {
		if (this.state.err) {
			return (
				<div
					style={{
						padding: 24,
						fontFamily: 'system-ui, sans-serif',
						color: '#e8f3eb',
						background: '#101914',
						minHeight: '100vh',
						maxWidth: 640,
					}}>
					<h1 style={{ color: '#f87171', marginTop: 0 }}>Грешка при зареждане</h1>
					<p style={{ color: '#94a3b8', marginBottom: 16 }}>
						Обновете страницата. Ако пак се появи, отворете инструментите за разработчици (F12) → Console и
						проверете съобщенията.
					</p>
					<pre
						style={{
							whiteSpace: 'pre-wrap',
							fontSize: 13,
							background: '#141f18',
							padding: 12,
							borderRadius: 8,
							border: '1px solid #3d5248',
						}}>
						{this.state.err.message}
					</pre>
				</div>
			);
		}
		return this.props.children;
	}
}

const rootElement = document.getElementById('root');
if (!rootElement) {
	throw new Error('SIMA: missing #root in index.html');
}
const root = createRoot(rootElement);

root.render(
	<React.StrictMode>
		<ErrorBoundary>
			<App />
		</ErrorBoundary>
	</React.StrictMode>
);
