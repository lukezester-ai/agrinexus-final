import { ReactElement } from 'react';

interface IMenuItem {
	label: string;
	path: string;
}

export const Navbar = (): ReactElement => {
	const menuItems: IMenuItem[] = [
		{ label: 'Home', path: '/' },
		{ label: 'Marketplace', path: '#market' },
	];

	return (
		<nav className="navbar" aria-label="Secondary navigation">
			<a className="navbar-brand" href="/">
				AgriNexus
			</a>

			<ul className="navbar-nav">
				{menuItems.map(menuItem => (
					<li key={menuItem.path} className="nav-item">
						<a className="nav-link" href={menuItem.path}>
							{menuItem.label}
						</a>
					</li>
				))}
			</ul>
		</nav>
	);
};
