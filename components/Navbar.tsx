import React, { ReactElement } from 'react';
import { useLocation, NavLink } from 'react-router-dom';

interface IMenuItem {
	label: string;
	path: string;
}

export const Navbar = (): ReactElement => {
	const { pathname } = useLocation();

	const menuItems: IMenuItem[] = [
		{ label: 'Home', path: '/' },
		{ label: 'About', path: '/about' },
	];

	return (
		<nav className="navbar bg-body-tertiary">
			<div className="container-fluid px-3">
				<NavLink className={'navbar-brand'} to="/">
					React v19 TSX Starter
				</NavLink>

				<ul className="navbar-nav ms-auto flex-row gap-3">
					{menuItems.map(menuItem => (
						<li key={menuItem.path} className="nav-item">
							<NavLink
								className={[
									menuItem.path === pathname ? 'active' : '',
									' nav-link',
								].join(' ')}
								to={menuItem.path}>
								{menuItem.label}
							</NavLink>
						</li>
					))}
				</ul>
			</div>
		</nav>
	);
};
