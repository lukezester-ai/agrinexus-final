import { Brain, Globe2, Leaf, LogIn, RefreshCw, UserPlus } from 'lucide-react';
import type { View } from '../lib/appTypes';

type AppNavigationLabels = {
	brandHomeAria: string;
	langAria: string;
	navAssistant: string;
	navAutomation: string;
	navClients: string;
	navGetStarted: string;
	navHome: string;
	navLogin: string;
	navMarket: string;
	navPricing: string;
	navPrimaryAria: string;
	navWatchlist: string;
};

type AppNavigationProps = {
	labels: AppNavigationLabels;
	lang: 'bg' | 'en';
	view: View;
	onLanguageToggle: () => void;
	onViewChange: (view: View) => void;
};

const navItems: Array<{ view: View; labelKey: keyof AppNavigationLabels; icon?: 'assistant' | 'automation' | 'login' }> = [
	{ view: 'landing', labelKey: 'navHome' },
	{ view: 'market', labelKey: 'navMarket' },
	{ view: 'assistant', labelKey: 'navAssistant', icon: 'assistant' },
	{ view: 'automation', labelKey: 'navAutomation', icon: 'automation' },
	{ view: 'pricing', labelKey: 'navPricing' },
	{ view: 'clients', labelKey: 'navClients' },
	{ view: 'watchlist', labelKey: 'navWatchlist' },
	{ view: 'login', labelKey: 'navLogin', icon: 'login' },
];

export function AppNavigation({
	labels,
	lang,
	view,
	onLanguageToggle,
	onViewChange,
}: AppNavigationProps) {
	return (
		<nav className="nav" aria-label={labels.navPrimaryAria}>
			<button
				type="button"
				className="brand"
				onClick={() => onViewChange('landing')}
				aria-label={labels.brandHomeAria}>
				<Leaf color="var(--green)" size={24} aria-hidden />
				<span className="brand-wordmark">
					<span className="brand-agri">Agri</span>
					<span className="brand-nexus">Nexus</span>
				</span>
			</button>
			<div className="nav-actions">
				{navItems.map(item => (
					<button
						key={item.view}
						type="button"
						className={`nav-link nav-link-mobile-hide ${view === item.view ? 'active' : ''}`}
						onClick={() => onViewChange(item.view)}>
						{item.icon === 'assistant' && <Brain size={14} aria-hidden />}
						{item.icon === 'automation' && <RefreshCw size={14} aria-hidden />}
						{item.icon === 'login' && <LogIn size={14} aria-hidden />}
						{labels[item.labelKey]}
					</button>
				))}
				<button type="button" className="btn-mini" aria-label={labels.langAria} onClick={onLanguageToggle}>
					<Globe2 size={14} aria-hidden /> {lang === 'bg' ? 'EN' : 'BG'}
				</button>
				<button type="button" className="btn btn-primary" onClick={() => onViewChange('register')}>
					<UserPlus size={14} aria-hidden /> {labels.navGetStarted}
				</button>
			</div>
		</nav>
	);
}
