# Skill Squad website

Standalone bilingual (English/Bulgarian) company website for Skill Squad, using plain HTML, CSS and JavaScript without a build step or runtime service. It is the marketing front door for Skill Squad and its own products; the dashboard lives in `apps/web`.

## Preview

Open `index.html` in a browser. The language toggle switches between English and Bulgarian and remembers the visitor's choice.

## Configuration

Edit `site.config.js` to change the public contact email. Contact currently points to `lukezester@gmail.com`. `productUrl` is intentionally empty: the product call to action is an early-access email, not a link to another site.

## Deploy

The site can be served as static files from the repository root. No build command or framework root directory is required. Configure the hosting project to use the repository root as its output source.

## Content notes

The featured product is **Skill Squad Core**, marked as early access with a request-an-invite email. The page avoids invented client names, results, and unsupported technology/vendor claims.
