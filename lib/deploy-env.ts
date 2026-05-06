/** Vercel задава VERCEL=1; локален production билд ползва NODE_ENV=production. */
export function isDeployProductionLike(): boolean {
	return process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
}
