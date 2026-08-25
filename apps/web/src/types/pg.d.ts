declare module "pg" {
	export class Client {
		constructor(config: { connectionString?: string });
		connect(): Promise<void>;
		query(
			text: string,
			params?: unknown[],
		): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
		end(): Promise<void>;
	}
}
