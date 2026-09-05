import type { IncomingMessage, ServerResponse } from 'node:http';

export type VercelRequest = IncomingMessage & {
	query: Record<string, string | string[]>;
	body: unknown;
};

export type VercelResponse = ServerResponse & {
	json: (body: unknown) => VercelResponse;
	status: (statusCode: number) => VercelResponse;
};
