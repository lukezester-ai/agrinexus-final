import YahooFinance from "yahoo-finance2";

/** Един инстанс за Vercel функции — v3 изисква `new YahooFinance()`, не статични методи върху default export. */
export const yahooFinance = new YahooFinance({
	suppressNotices: ["yahooSurvey", "ripHistorical"],
});
