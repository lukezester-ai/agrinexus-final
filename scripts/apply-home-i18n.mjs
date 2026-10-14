import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const p = join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html');
let h = readFileSync(p, 'utf8');

function rep(a, b) {
	if (!h.includes(a)) {
		console.warn('MISS:', a.slice(0, 50).replace(/\n/g, ' '));
		return;
	}
	h = h.replace(a, b);
}

rep(
	`<p class="lead-deck">
        Moscow's revised export levy lifts CBOT wheat futures 4.2% in a week; Argentine drought 
        and weak Russian harvest reinforce a bullish short-term outlook for European mills.
      </p>`,
	`<p class="lead-deck" data-i18n="home.lead.deck">Moscow's revised export levy lifts CBOT wheat futures 4.2% in a week; Argentine drought and weak Russian harvest reinforce a bullish short-term outlook for European mills.</p>`,
);
rep('<span class="author">By Furrow Markets Desk</span>', '<span class="author" data-i18n="home.lead.author">By Furrow Markets Desk</span>');
rep('<span>6 min read</span>', '<span data-i18n="home.lead.readtime">6 min read</span>');
rep('<span>May 18, 2026 · 12:45 GMT</span>', '<span data-i18n="home.lead.date">May 18, 2026 · 12:45 GMT</span>');
rep(
	`<div class="lead-body">
        <p>
          Wheat prices broke through a six-month resistance level on Friday, with CBOT July futures 
          settling at $245.50 per ton — the highest close since November. The 4.2% weekly gain reflects 
          a confluence of supply concerns originating in the Black Sea, where Russia's adjusted export 
          tax of $14 per ton has begun to deter shipments to traditional buyers in North Africa and the 
          Middle East.
        </p>
        <p>
          European mills, already operating with thin inventory cover after a difficult 2025 harvest, 
          are responding by booking forward positions through August. French and German benchmark 
          contracts moved in lockstep, with Euronext milling wheat closing at €232 per ton, up 3.8% 
          on the week.
        </p>
      </div>
      <a href="#" class="lead-cta">Continue reading →</a>`,
	`<div class="lead-body">
        <p data-i18n="home.lead.p1">Wheat prices broke through a six-month resistance level on Friday...</p>
        <p data-i18n="home.lead.p2">European mills, already operating with thin inventory cover...</p>
      </div>
      <a href="article/sample.html" class="lead-cta" data-i18n="home.lead.cta">Continue reading →</a>`,
);
rep('<div class="sidebar-label">In Brief</div>', '<div class="sidebar-label" data-i18n="home.brief.label">In Brief</div>');
rep('<div class="sidebar-label">Key Numbers Today</div>', '<div class="sidebar-label" data-i18n="home.numbers.label">Key Numbers Today</div>');
for (const [label, key] of [
	['CBOT Wheat', 'home.numbers.wheat'],
	['CBOT Corn', 'home.numbers.corn'],
	['Soybeans', 'home.numbers.soy'],
	['Baltic Dry', 'home.numbers.baltic'],
]) {
	rep(`<div class="key-data-label">${label}</motion>`, `<div class="key-data-label" data-i18n="${key}">${label}</div>`.replace('motion', 'div'));
	rep(`<div class="key-data-label">${label}</div>`, `<div class="key-data-label" data-i18n="${key}">${label}</motion>`.replace('motion', 'motion'));
}

const brief = [
	['<li><strong>Wheat</strong> closes at six-month high amid Russian export friction</li>', 'home.brief.1'],
	['<li><strong>Argentine drought</strong> threatens 2026 corn yields; CONAB cuts forecast 3%</li>', 'home.brief.2'],
	['<li><strong>EU rapeseed</strong> imports fall 12% YoY on weaker Ukrainian flows</li>', 'home.brief.3'],
	['<li><strong>Brazil</strong> begins early soybean export season; logistics tight</li>', 'home.brief.4'],
	['<li><strong>Palm oil</strong> retreats from monthly high on Malaysian inventory data</li>', 'home.brief.5'],
];
for (const [line, key] of brief) {
	h = h.replace(line, `<li data-i18n-html="${key}">${line.slice(4, -5)}</li>`);
}

rep('<h2>Today\'s Analysis</h2>', '<h2 data-i18n="home.today.title">Today\'s Analysis</h2>');
rep('<a href="#" class="more">All analyses →</a>', '<a href="#" class="more" data-i18n="home.today.more">All analyses →</a>');
rep('<h2>Latest</h2>', '<h2 data-i18n="home.latest.title">Latest</h2>');
rep('<a href="#" class="more">Full archive →</a>', '<a href="#" class="more" data-i18n="home.latest.more">Full archive →</a>');

rep('<motion class="story-cat">Oilseeds · South America</motion>', '<div class="story-cat" data-i18n="home.s1.cat">Oilseeds · South America</div>'.replace(/motion/g, 'div'));
rep('<div class="story-cat">Oilseeds · South America</div>', '<div class="story-cat" data-i18n="home.s1.cat">Oilseeds · South America</div>');
rep(
	"<h3><a href=\"#\">Argentina's Soy Harvest Defies Drought Fears, But Logistics Will Test Exports</a></h3>",
	"<h3><a href=\"/egypt-fields-desert-oasis-2026\" data-i18n=\"home.s1.title\">Egypt's Fields: The Desert Oasis That Feeds 108 Million People</a></h3>",
);
rep('<div class="story-cat">Black Sea · Politics</div>', '<div class="story-cat" data-i18n="home.s2.cat">Black Sea · Politics</div>');
rep(
	'<h3><a href="#">Russian Export Quota Mechanics: How a $14/Ton Tax Reshapes Global Wheat Trade</a></h3>',
	'<h3><a href="article/sample.html" data-i18n="home.s2.title">Russian Export Quota Mechanics: How a $14/Ton Tax Reshapes Global Wheat Trade</a></h3>',
);
rep('<div class="story-cat">Weather · North America</div>', '<div class="story-cat" data-i18n="home.s3.cat">Weather · North America</div>');

rep('<div class="col-title">By Market</div>', '<div class="col-title" data-i18n="home.col.market">By Market</div>');
rep('<div class="col-title">By Region</div>', '<div class="col-title" data-i18n="home.col.region">By Region</div>');

const latest = [
	['Dairy · EU', 'EU butter prices ease as Polish output expands; cheese remains tight', 'home.l1'],
	['Softs · Brazil', 'Arabica futures retreat on Brazilian harvest progress, hedge unwinding', 'home.l2'],
	['Fertilizer · Global', 'Urea prices stabilize after a volatile week; Indian tender awaited', 'home.l3'],
	['Grains · Kazakhstan', 'Kazakh wheat exports to China rise 28% YoY in April', 'home.l4'],
	['Livestock · US', 'US cattle inventory at 73-year low; ranchers cautious on rebuilding', 'home.l5'],
	['Shipping · Black Sea', 'Bosphorus transit times normalize; insurance premiums hold elevated', 'home.l6'],
	['Special Report · Premium', 'Monthly Outlook: Grains and oilseeds positioning for Northern Hemisphere harvest', 'home.l7'],
	['Policy · EU', 'CAP 2027 reform proposal: implications for grain producers in EU East', 'home.l8'],
];
for (const [cat, title, key] of latest) {
	h = h.replace(`<div class="cat">${cat}</div>`, `<div class="cat" data-i18n="${key}.cat">${cat}</div>`);
	h = h.replace(`<h4><a href="#">${title}</a></h4>`, `<h4><a href="article/sample.html" data-i18n="${key}.title">${title}</a></h4>`);
}

if (!h.includes('i18n-home-strings')) {
	h = h.replace(
		'<script src="scripts/i18n-strings.js"></script>',
		'<script src="scripts/i18n-strings.js"></script>\n<script src="scripts/i18n-home-strings.js"></script>',
	);
}

writeFileSync(p, h);
console.log('applied');
