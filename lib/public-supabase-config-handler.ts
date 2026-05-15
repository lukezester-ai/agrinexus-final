export function handlePublicSupabaseConfigGet():
	| { ok: true; supabaseUrl: string; supabaseAnonKey: string }
	| { ok: false; status: number; error: string } {
	const supabaseUrl = (
		process.env.VITE_SUPABASE_URL?.trim() ||
		process.env.SUPABASE_URL?.trim() ||
		''
	);
	const supabaseAnonKey = (
		process.env.VITE_SUPABASE_ANON_KEY?.trim() ||
		process.env.SUPABASE_ANON_KEY?.trim() ||
		''
	);
	if (!supabaseUrl || !supabaseAnonKey) {
		return {
			ok: false,
			status: 503,
			error: 'Липсва публична Supabase конфигурация (URL + anon key).',
		};
	}
	return { ok: true, supabaseUrl, supabaseAnonKey };
}
