import { useEffect, useState } from 'react';

import type { SeasonVisual } from '../lib/season-calendar-visuals';

function SkyGround({ sky, ground }: { sky: string; ground: string }) {
	return (
		<>
			<rect x="0" y="0" width="160" height="52" fill={sky} />
			<rect x="0" y="52" width="160" height="38" fill={ground} />
			<ellipse cx="120" cy="48" rx="36" ry="10" fill="rgba(255,255,255,.06)" />
		</>
	);
}

/** Комбайн — жътва */
function ArtCombine() {
	return (
		<g>
			<SkyGround sky="#60a5fa" ground="#78350f" />
			{/* житни стъбла */}
			{[8, 22, 38, 54, 72, 92].map((x, i) => (
				<path
					key={i}
					d={`M${x} 52 L${x - 3} 34 L${x + 2} 36 Z`}
					fill="#ca8a04"
					opacity={0.85}
				/>
			))}
			{/* кабина */}
			<rect x="52" y="28" width="38" height="22" rx="3" fill="#15803d" />
			<rect x="56" y="32" width="14" height="10" rx="1" fill="#86efac" opacity={0.35} />
			{/* корпус */}
			<rect x="88" y="34" width="48" height="18" rx="2" fill="#ca8a04" />
			<rect x="92" y="30" width="40" height="8" rx="2" fill="#eab308" />
			{/* хедер */}
			<rect x="24" y="38" width="32" height="12" rx="2" fill="#a16207" />
			<rect x="26" y="40" width="4" height="8" fill="#713f12" opacity={0.6} />
			<rect x="34" y="40" width="4" height="8" fill="#713f12" opacity={0.6} />
			<rect x="42" y="40" width="4" height="8" fill="#713f12" opacity={0.6} />
			{/* гуми */}
			<circle cx="62" cy="52" r="8" fill="#27272a" />
			<circle cx="62" cy="52" r="4" fill="#52525b" />
			<circle cx="118" cy="52" r="7" fill="#27272a" />
			<circle cx="118" cy="52" r="3.5" fill="#52525b" />
		</g>
	);
}

/** Трактор + оран */
function ArtTractorPlow() {
	return (
		<g>
			<SkyGround sky="#38bdf8" ground="#5d4037" />
			{/* бразди */}
			{[0, 12, 24, 36, 48].map((o, i) => (
				<path key={i} d={`M${20 + o} 52 L${24 + o} 72 L${28 + o} 52 Z`} fill="#4e342e" opacity={0.5} />
			))}
			<rect x="58" y="30" width="28" height="20" rx="3" fill="#166534" />
			<rect x="84" y="32" width="36" height="16" rx="2" fill="#ea580c" />
			<rect x="118" y="36" width="22" height="6" rx="1" fill="#9a3412" />
			<circle cx="68" cy="52" r="9" fill="#27272a" />
			<circle cx="100" cy="52" r="9" fill="#27272a" />
			<path d="M 138 44 L 152 52 L 138 58 Z" fill="#78716c" />
		</g>
	);
}

/** Сеитба */
function ArtSeeding() {
	return (
		<g>
			<SkyGround sky="#7dd3fc" ground="#78716c" />
			{[18, 42, 68, 94].map((x, i) => (
				<line key={i} x1={x} y1="54" x2={x - 6} y2="72" stroke="#a8a29e" strokeWidth="2" opacity={0.5} />
			))}
			<rect x="72" y="28" width="30" height="22" rx="3" fill="#15803d" />
			<rect x="100" y="32" width="40" height="14" rx="2" fill="#ca8a04" />
			<rect x="56" y="40" width="20" height="8" rx="2" fill="#57534e" />
			<circle cx="78" cy="52" r="8" fill="#27272a" />
			<circle cx="124" cy="52" r="8" fill="#27272a" />
			{/* семена точки */}
			{[34, 48, 62].map((x, i) => (
				<circle key={i} cx={x} cy="62" r="2" fill="#fde047" />
			))}
		</g>
	);
}

/** Млади посеви */
function ArtYoungCrop() {
	return (
		<g>
			<SkyGround sky="#bae6fd" ground="#365314" />
			{Array.from({ length: 14 }).map((_, i) => (
				<path
					key={i}
					d={`M${10 + i * 11} 52 Q ${12 + i * 11} 40 ${14 + i * 11} 52`}
					stroke="#86efac"
					strokeWidth="2.5"
					fill="none"
				/>
			))}
		</g>
	);
}

/** ДФЗ / документи */
function ArtDocs() {
	return (
		<g>
			<rect width="160" height="90" fill="#1a2820" />
			<rect x="38" y="16" width="84" height="58" rx="4" fill="#f8fafc" opacity={0.92} />
			<rect x="48" y="28" width="64" height="4" rx="1" fill="#94a3b8" />
			<rect x="48" y="38" width="52" height="4" rx="1" fill="#cbd5e1" />
			<rect x="48" y="48" width="58" height="4" rx="1" fill="#cbd5e1" />
			<path d="M52 58 L72 68 L108 52" stroke="#22c55e" strokeWidth="3" fill="none" strokeLinecap="round" />
			<circle cx="118" cy="26" r="14" fill="#5eead4" opacity={0.35} />
			<path d="M118 20 L118 32 M112 26 L124 26" stroke="#0f766e" strokeWidth="2" />
		</g>
	);
}

/** Пръскачка */
function ArtSpray() {
	return (
		<g>
			<SkyGround sky="#67e8f9" ground="#365314" />
			<path d="M20 34 Q40 28 60 34 Q80 40 100 34 Q120 28 140 34" stroke="#a5f3fc" strokeWidth="2" fill="none" opacity={0.7} />
			<circle cx="34" cy="30" r="2.5" fill="#e0f2fe" opacity={0.8} />
			<circle cx="72" cy="26" r="2" fill="#e0f2fe" opacity={0.7} />
			<rect x="62" y="34" width="32" height="18" rx="3" fill="#166534" />
			<rect x="92" y="36" width="44" height="10" rx="2" fill="#f97316" />
			<rect x="54" y="40" width="12" height="4" fill="#64748b" />
			<circle cx="72" cy="52" r="8" fill="#27272a" />
			<circle cx="124" cy="52" r="8" fill="#27272a" />
		</g>
	);
}

/** Зърно / логистика */
function ArtGrain() {
	return (
		<g>
			<SkyGround sky="#93c5fd" ground="#57534e" />
			<rect x="28" y="22" width="28" height="36" rx="2" fill="#d6d3d1" />
			<polygon points="28,22 42,10 56,22" fill="#a8a29e" />
			<rect x="96" y="36" width="48" height="20" rx="3" fill="#ca8a04" />
			<rect x="108" y="28" width="24" height="10" rx="2" fill="#eab308" />
			<circle cx="108" cy="58" r="7" fill="#27272a" />
			<circle cx="138" cy="58" r="7" fill="#27272a" />
			{[18, 26, 34].map((y, i) => (
				<circle key={i} cx="42" cy={y} r="3" fill="#fde047" opacity={0.7} />
			))}
		</g>
	);
}

/** Слънчоглед */
function ArtSunflower() {
	return (
		<g>
			<SkyGround sky="#38bdf8" ground="#713f12" />
			<rect x="76" y="42" width="7" height="28" fill="#365314" rx="1" />
			<circle cx="78" cy="32" r="20" fill="#facc15" />
			{Array.from({ length: 10 }).map((_, i) => {
				const a = (i * Math.PI * 2) / 10;
				const x = 78 + Math.cos(a) * 14;
				const y = 32 + Math.sin(a) * 14;
				return <circle key={i} cx={x} cy={y} r="5" fill="#fde047" opacity={0.95} />;
			})}
			<circle cx="78" cy="32" r="11" fill="#78350f" />
		</g>
	);
}

/** Царевица */
function ArtCorn() {
	return (
		<g>
			<SkyGround sky="#7dd3fc" ground="#422006" />
			{[24, 46, 68, 92, 118].map((x, i) => (
				<g key={i}>
					<rect x={x} y={28 + (i % 2) * 4} width="5" height="36" fill="#4d7c0f" rx="1" />
					<ellipse cx={x + 2.5} cy="26" rx="8" ry="4" fill="#bef264" opacity={0.9} />
				</g>
			))}
		</g>
	);
}

/** Напояване */
function ArtIrrigate() {
	return (
		<g>
			<SkyGround sky="#0284c7" ground="#365314" />
			{[40, 58, 76, 94].map((x, i) => (
				<g key={i}>
					<path d={`M${x} 56 L${x} 72`} stroke="#38bdf8" strokeWidth="3" strokeDasharray="4 3" />
					<ellipse cx={x} cy="54" rx="3" ry="5" fill="#7dd3fc" opacity={0.85} />
				</g>
			))}
			<rect x="118" y="30" width="28" height="16" rx="2" fill="#64748b" opacity={0.9} />
		</g>
	);
}

/** Лозя */
function ArtVine() {
	return (
		<g>
			<SkyGround sky="#c4b5fd" ground="#3b0764" />
			{[28, 52, 76, 100].map((x, i) => (
				<line key={i} x1={x} y1="72" x2={x} y2="38" stroke="#78716c" strokeWidth="3" />
			))}
			<path d="M28 48 Q52 36 76 44 T124 40" stroke="#86efac" strokeWidth="3" fill="none" />
			<path d="M32 56 Q58 44 88 52" stroke="#86efac" strokeWidth="2.5" fill="none" opacity={0.85} />
			<ellipse cx="70" cy="42" rx="8" ry="6" fill="#a855f7" opacity={0.5} />
		</g>
	);
}

/** Гроздобер */
function ArtGrapes() {
	return (
		<g>
			<SkyGround sky="#ddd6fe" ground="#4c1d95" />
			<path d="M84 72 L84 44" stroke="#57534e" strokeWidth="4" />
			{[0, 1, 2, 3, 4].flatMap((_, ri) =>
				[0, 1, 2].map(col => (
					<circle
						key={`${ri}-${col}`}
						cx={74 + col * 10}
						cy={50 + ri * 8}
						r="5"
						fill={ri % 2 === 0 ? '#7c3aed' : '#6d28d9'}
					/>
				)),
			)}
			<rect x="110" y="48" width="28" height="18" rx="2" fill="#92400e" opacity={0.85} />
		</g>
	);
}

/** Вино / бъчви */
function ArtWine() {
	return (
		<g>
			<rect width="160" height="90" fill="#292524" />
			<ellipse cx="54" cy="58" rx="22" ry="28" fill="#78350f" />
			<rect x="42" y="40" width="24" height="20" fill="#92400e" />
			<ellipse cx="54" cy="40" rx="22" ry="8" fill="#a16207" />
			<ellipse cx="108" cy="56" rx="20" ry="24" fill="#713f12" />
			<rect x="96" y="40" width="24" height="18" fill="#854d0e" />
			<ellipse cx="108" cy="40" rx="20" ry="7" fill="#a16207" />
			<rect x="126" y="30" width="8" height="28" rx="2" fill="#14532d" opacity={0.9} />
			<rect x="124" y="26" width="12" height="8" rx="2" fill="#166534" />
		</g>
	);
}

/** Овощар резитба */
function ArtOrchardPrune() {
	return (
		<g>
			<SkyGround sky="#99f6e4" ground="#14532d" />
			<rect x="74" y="36" width="10" height="36" fill="#78350f" rx="1" />
			<ellipse cx="62" cy="34" rx="28" ry="22" fill="#166534" opacity={0.95} />
			<ellipse cx="98" cy="32" rx="24" ry="18" fill="#15803d" opacity={0.9} />
			<path d="M118 48 L132 38 L128 52 Z" fill="#cbd5e1" stroke="#64748b" />
		</g>
	);
}

/** Ябълки / беритба */
function ArtOrchardFruit() {
	return (
		<g>
			<SkyGround sky="#fdba74" ground="#365314" />
			<rect x="78" y="40" width="8" height="32" fill="#78350f" />
			<circle cx="72" cy="36" r="22" fill="#4d7c0f" />
			{[
				[68, 34],
				[82, 38],
				[74, 46],
				[88, 30],
			].map(([x, y], i) => (
				<circle key={i} cx={x} cy={y} r="5" fill="#dc2626" />
			))}
			<path d="M72 14 Q76 22 72 26" stroke="#854d0e" strokeWidth="2" fill="none" />
		</g>
	);
}

/** Зима / планиране поле */
function ArtWinter() {
	return (
		<g>
			<rect width="160" height="90" fill="#475569" />
			<rect x="0" y="52" width="160" height="38" fill="#e2e8f0" opacity={0.95} />
			{[12, 36, 58, 82, 106].map((x, i) => (
				<path key={i} d={`M${x} 54 L${x + 4} 72 L${x - 2} 72 Z`} fill="#cbd5e1" opacity={0.35} />
			))}
			{[24, 52, 78, 104].map((x, i) => (
				<g key={i} opacity={0.85}>
					<circle cx={x} cy="34" r="3" fill="#fff" />
					<circle cx={x + 5} cy="40" r="2.2" fill="#fff" opacity={0.8} />
				</g>
			))}
		</g>
	);
}

/** План семена */
function ArtSeedsPlan() {
	return (
		<g>
			<rect width="160" height="90" fill="#264036" />
			<rect x="34" y="20" width="52" height="52" rx="4" fill="#f8fafc" opacity={0.12} stroke="#5eead4" strokeWidth="1.5" />
			<circle cx="52" cy="38" r="6" fill="#fbbf24" />
			<circle cx="74" cy="52" r="5" fill="#fbbf24" opacity={0.85} />
			<circle cx="62" cy="62" r="4" fill="#fbbf24" opacity={0.7} />
			<path d="M96 28 L118 28 L118 64 L96 64 Z" fill="#166534" opacity={0.85} rx="2" />
			<text x="100" y="52" fontSize="22" fill="#fde047">
				🌾
			</text>
		</g>
	);
}

function ArtSwitch({ visual }: { visual: SeasonVisual }) {
	switch (visual) {
		case 'combine_harvest':
			return <ArtCombine />;
		case 'tractor_soil':
			return <ArtTractorPlow />;
		case 'seeding':
			return <ArtSeeding />;
		case 'young_crop':
			return <ArtYoungCrop />;
		case 'docs_admin':
			return <ArtDocs />;
		case 'spray_field':
			return <ArtSpray />;
		case 'grain_logistics':
			return <ArtGrain />;
		case 'sunflower_gold':
			return <ArtSunflower />;
		case 'corn_rows':
			return <ArtCorn />;
		case 'irrigate':
			return <ArtIrrigate />;
		case 'vine_row':
			return <ArtVine />;
		case 'grape_harvest':
			return <ArtGrapes />;
		case 'wine_cellar':
			return <ArtWine />;
		case 'orchard_prune':
			return <ArtOrchardPrune />;
		case 'orchard_fruit':
			return <ArtOrchardFruit />;
		case 'winter_rest':
			return <ArtWinter />;
		case 'seeds_plan':
		default:
			return <ArtSeedsPlan />;
	}
}

export function SeasonMonthArtBanner({ visual }: { visual: SeasonVisual }) {
	const [photoFailed, setPhotoFailed] = useState(false);

	useEffect(() => {
		setPhotoFailed(false);
	}, [visual]);

	return (
		<div
			aria-hidden
			className="season-cal-photo-banner"
			style={{
				position: 'relative',
				borderRadius: 14,
				overflow: 'hidden',
				marginBottom: 14,
				height: 132,
				boxShadow:
					'inset 0 0 0 1px rgba(124, 205, 156, 0.18), 0 12px 28px rgba(0, 0, 0, 0.28)',
				background: '#0e1712',
			}}>
			{photoFailed ? (
				<svg width="100%" height="100%" viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" style={{ display: 'block' }}>
					<ArtSwitch visual={visual} />
				</svg>
			) : (
				<>
					<img
						src={`/season-cal/${visual}.jpg`}
						alt=""
						key={visual}
						width={840}
						height={472}
						loading="lazy"
						decoding="async"
						onError={() => setPhotoFailed(true)}
						style={{
							width: '100%',
							height: '100%',
							objectFit: 'cover',
							objectPosition: 'center center',
							display: 'block',
						}}
					/>
					<div
						style={{
							position: 'absolute',
							inset: 0,
							pointerEvents: 'none',
							background:
								'linear-gradient(180deg, rgba(10, 17, 14, 0.08) 0%, rgba(10, 17, 14, 0.02) 38%, rgba(10, 17, 14, 0.55) 100%)',
							}}
					/>
				</>
			)}
		</div>
	);
}
