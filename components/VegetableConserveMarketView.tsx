import { useEffect, useMemo, useState } from 'react';
import type { AppStrings, UiLang } from '../lib/i18n';
import {
	calendarDayISOLocal,
	getVegetableConserveCatalogForDay,
	VEGETABLE_CONSERVE_CATALOG_DISCLAIMER_BG,
	VEGETABLE_CONSERVE_CATALOG_DISCLAIMER_EN,
} from '../lib/vegetable-conserve-catalog';

type Props = {
	lang: UiLang;
	tr: AppStrings;
};

export function VegetableConserveMarketView({ lang, tr }: Props) {
	const [pricingDay, setPricingDay] = useState(() => calendarDayISOLocal(new Date()));

	useEffect(() => {
		const sync = () => {
			const today = calendarDayISOLocal(new Date());
			setPricingDay(prev => (prev === today ? prev : today));
		};
		sync();
		const id = window.setInterval(sync, 30_000);
		return () => window.clearInterval(id);
	}, []);

	const rows = useMemo(() => getVegetableConserveCatalogForDay(pricingDay), [pricingDay]);

	const disclaimer = lang === 'bg' ? VEGETABLE_CONSERVE_CATALOG_DISCLAIMER_BG : VEGETABLE_CONSERVE_CATALOG_DISCLAIMER_EN;

	return (
		<section className="section">
			<div className="market-head">
				<div>
					<h2 style={{ margin: '0 0 6px' }}>{tr.marketPageTitle}</h2>
					<p className="green-note" style={{ margin: '0 0 10px', maxWidth: 720, lineHeight: 1.5, fontWeight: 650 }}>
						{tr.taglineProducerBuyerBridge}
					</p>
					<p className="muted" style={{ margin: '0 0 10px', maxWidth: 720, fontSize: '.85rem', lineHeight: 1.45 }}>
						{tr.brandFoundationNote}
					</p>
					<p className="muted" style={{ margin: 0, maxWidth: 720, lineHeight: 1.5 }}>
						{tr.marketPageSubtitle}
					</p>
					<p className="muted" style={{ margin: '10px 0 0', fontSize: '.88rem' }}>
						<strong style={{ color: 'var(--accent-text)' }}>{tr.marketAsOfLabel}:</strong> {pricingDay}{' '}
						· {tr.marketDailyRefreshNote}
					</p>
				</div>
			</div>

			<div className="demo-banner" role="note">
				{disclaimer} {tr.marketDemoDailyNote}
			</div>

			<div className="table-shell" style={{ marginTop: 14 }}>
				<table className="data-table">
					<thead>
						<tr>
							<th>{tr.marketColCategory}</th>
							<th>{tr.marketColProduct}</th>
							<th>{tr.marketColPack}</th>
							<th>{tr.marketColPriceBgn}</th>
							<th>{tr.marketColPriceEur}</th>
							<th>{tr.marketColUnit}</th>
							<th>{tr.marketColNotes}</th>
						</tr>
					</thead>
					<tbody>
						{rows.map(row => (
							<tr key={row.id}>
								<td>{row.categoryBg}</td>
								<td>{lang === 'bg' ? row.productBg : row.productEn}</td>
								<td>{lang === 'bg' ? row.packaging.specBg : row.packaging.specEn}</td>
								<td>
									<strong>{row.priceExWorksBgn.toFixed(2)}</strong> лв.
								</td>
								<td>~{row.priceExWorksEurApprox.toFixed(2)} €</td>
								<td>{lang === 'bg' ? row.unitBg : row.unitEn}</td>
								<td className="muted" style={{ fontSize: '.82rem', maxWidth: 280 }}>
									{lang === 'bg' ? row.notesBg : row.notesEn}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</section>
	);
}
