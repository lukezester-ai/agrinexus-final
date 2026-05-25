/**
 * Финален тест към курс: въпроси с четири варианта.
 */
export type QuizQuestion = {
	id: string;
	text: string;
	options: readonly [string, string, string, string];
	correctIndex: 0 | 1 | 2 | 3;
};

export type CourseFinalTest = {
	questions: QuizQuestion[];
};

export type QuestionRow = readonly [string, readonly [string, string, string, string], 0 | 1 | 2 | 3];

/** Минимален дял верни отговори за успех (80% → при 25 въпроса са нужни 20 верни). */
export const PASS_SHARE = 0.8;

export function correctAnswersToPass(total: number): number {
	return Math.max(1, Math.ceil(PASS_SHARE * total));
}

export function rowsToQuestions(slug: string, rows: readonly QuestionRow[]): QuizQuestion[] {
	return rows.map((r, i) => ({
		id: `${slug}-q${i + 1}`,
		text: r[0],
		options: r[1],
		correctIndex: r[2],
	}));
}
