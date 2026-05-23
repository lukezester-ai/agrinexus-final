import { ChatMistralAI } from '@langchain/mistralai';

export function getChatMistral(modelName?: string): ChatMistralAI {
	const name =
		modelName?.trim() ||
		process.env.MISTRAL_MESH_MODEL?.trim() ||
		'mistral-small-latest';
	return new ChatMistralAI({
		modelName: name,
		temperature: 0.2,
	});
}
