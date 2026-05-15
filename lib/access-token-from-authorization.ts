/** Извлича access token от `Authorization: Bearer <jwt>` или голи JWT string. */
export function accessTokenFromAuthorizationHeader(header: string | undefined): string | null {
	if (!header || typeof header !== 'string') return null;
	const t = header.trim();
	const m = /^Bearer\s+(\S+)$/i.exec(t);
	return (m ? m[1] : t).trim() || null;
}
