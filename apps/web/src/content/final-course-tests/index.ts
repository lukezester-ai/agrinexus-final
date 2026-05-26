import { cropMarketsRows } from "./crop-markets";
import { dronePilotsRows } from "./drone-pilots";
import { farmFinanceRows } from "./farm-finance";
import { precisionDataRows } from "./precision-data";
import { soilFertilityRows } from "./soil-fertility";
import {
	type CourseFinalTest,
	PASS_SHARE,
	correctAnswersToPass,
	rowsToQuestions,
	type QuizQuestion,
	type QuestionRow,
} from "./types";
import { waterIrrigationRows } from "./water-irrigation";

export type { CourseFinalTest, QuizQuestion, QuestionRow };
export { PASS_SHARE, correctAnswersToPass };

const EXPECTED = 25;

function pack(slug: string, rows: readonly QuestionRow[]): CourseFinalTest {
	if (rows.length !== EXPECTED) {
		throw new Error(`Course ${slug}: expected ${EXPECTED} questions, got ${rows.length}`);
	}
	return { questions: rowsToQuestions(slug, rows) };
}

const FINAL_TESTS_BY_SLUG: Record<string, CourseFinalTest> = {
	"soil-fertility": pack("soil-fertility", soilFertilityRows),
	"crop-markets": pack("crop-markets", cropMarketsRows),
	"water-irrigation": pack("water-irrigation", waterIrrigationRows),
	"farm-finance": pack("farm-finance", farmFinanceRows),
	"precision-data": pack("precision-data", precisionDataRows),
	"drone-pilots": pack("drone-pilots", dronePilotsRows),
};

export function getFinalTest(slug: string): CourseFinalTest | undefined {
	return FINAL_TESTS_BY_SLUG[slug];
}
