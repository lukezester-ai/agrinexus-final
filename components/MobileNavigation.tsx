import { Bookmark, Brain, CreditCard, Leaf, Search } from 'lucide-react';
import type { View } from '../lib/appTypes';

type MobileNavigationLabels = {
	mobileAssistantTab: string;
	mobileNavAria: string;
	navAssistant: string;
	navHome: string;
	navMarket: string;
	navPricing: string;
	navWatchlist: string;
};

type MobileNavigationProps = {
	labels: MobileNavigationLabels;
	view: View;
	onViewChange: (view: View) => void;
};

const mobileNavItems: Array<{
	view: View;
	labelKey: keyof MobileNavigationLabels;
	ariaLabelKey?: keyof MobileNavigationLabels;
	icon: typeof Leaf;
}> = [
	{ view: 'landing', labelKey: 'navHome', icon: Leaf },
	{ view: 'market', labelKey: 'navMarket', icon: Search },
	{ view: 'assistant', labelKey: 'mobileAssistantTab', ariaLabelKey: 'navAssistant', icon: Brain },
	{ view: 'pricing', labelKey: 'navPricing', icon: CreditCard },
	{ view: 'watchlist', labelKey: 'navWatchlist', icon: Bookmark },
];

export function MobileNavigation({ labels, view, onViewChange }: MobileNavigationProps) {
	return (
		<div className="mobile-nav" role="navigation" aria-label={labels.mobileNavAria}>
			{mobileNavItems.map(item => {
				const Icon = item.icon;
				return (
					<button
						key={item.view}
						type="button"
						className={`mobile-nav-btn ${view === item.view ? 'active' : ''}`}
						onClick={() => onViewChange(item.view)}
						aria-label={item.ariaLabelKey ? labels[item.ariaLabelKey] : undefined}>
						<Icon size={16} aria-hidden />
						{labels[item.labelKey]}
					</button>
				);
			})}
		</div>
	);
}
