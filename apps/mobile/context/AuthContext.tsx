import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { requestBackendMe, requestBackendToken } from "../lib/api";
import { clearSession, loadSession, saveSession } from "../lib/tokenStorage";
import { invalidateCourseCatalogCache } from "../lib/courseCatalogCache";

type AuthCtx = {
	token: string | null;
	email: string | null;
	ready: boolean;
	signIn: (email: string) => Promise<void>;
	signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [token, setToken] = useState<string | null>(null);
	const [email, setEmail] = useState<string | null>(null);
	const [ready, setReady] = useState(false);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			const s = await loadSession();
			if (cancelled) return;
			if (s?.token) {
				setToken(s.token);
				setEmail(s.email || null);
				try {
					const me = await requestBackendMe(s.token);
					if (!cancelled) setEmail(me.email);
				} catch {
					/* keep stored email; token may be expired */
				}
			}
			if (!cancelled) setReady(true);
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const signIn = useCallback(async (rawEmail: string) => {
		const emailTrim = rawEmail.trim();
		const tr = await requestBackendToken(emailTrim);
		const me = await requestBackendMe(tr.access_token);
		await saveSession(tr.access_token, me.email);
		setToken(tr.access_token);
		setEmail(me.email);
		invalidateCourseCatalogCache();
	}, []);

	const signOut = useCallback(async () => {
		await clearSession();
		setToken(null);
		setEmail(null);
		invalidateCourseCatalogCache();
	}, []);

	const value = useMemo(
		() => ({ token, email, ready, signIn, signOut }),
		[token, email, ready, signIn, signOut],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const ctx = useContext(AuthContext);
	if (!ctx) {
		throw new Error("useAuth must be used within AuthProvider");
	}
	return ctx;
}
