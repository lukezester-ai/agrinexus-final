import { Client } from "pg";

export class FinanceDatabaseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "FinanceDatabaseError";
	}
}

export async function runFinanceCall(userId: string, call: { sql: string; params: unknown[] }): Promise<unknown[]> {
	const connectionString = process.env.FINANCE_APP_DATABASE_URL?.trim();
	if (!connectionString) throw new FinanceDatabaseError("finance database is not configured");
	const client = new Client({ connectionString });
	await client.connect();
	try {
		await client.query("BEGIN");
		const claims = JSON.stringify({ sub: userId, role: "authenticated", aud: "authenticated" });
		await client.query(
			"SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)",
			[userId, claims],
		);
		const result = await client.query(call.sql, call.params);
		await client.query("COMMIT");
		return result.rows;
	} catch (error) {
		await client.query("ROLLBACK");
		const message = error instanceof Error ? error.message : "finance call failed";
		throw new FinanceDatabaseError(message.split("\n")[0]);
	} finally {
		await client.end();
	}
}
