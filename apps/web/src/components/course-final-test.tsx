"use client";

import { useCallback, useMemo, useState } from "react";
import type { CourseFinalTest } from "@/content/final-course-tests";
import { PASS_SHARE, correctAnswersToPass } from "@/content/final-course-tests";

type Props = {
	courseTitle: string;
	test: CourseFinalTest;
};

export function CourseFinalTestQuiz({ courseTitle, test }: Props) {
	const total = test.questions.length;
	const needCorrect = useMemo(() => correctAnswersToPass(total), [total]);

	const [choice, setChoice] = useState<Record<string, number | null>>(() =>
		Object.fromEntries(test.questions.map((q) => [q.id, null] as const)),
	);
	const [submitted, setSubmitted] = useState(false);
	const [passed, setPassed] = useState<boolean | null>(null);
	const passPercent = Math.round(PASS_SHARE * 100);

	const score = useMemo(() => {
		if (!submitted) return null;
		let c = 0;
		for (const q of test.questions) {
			if (choice[q.id] === q.correctIndex) c++;
		}
		return c;
	}, [choice, submitted, test.questions]);

	const fireConfetti = useCallback(() => {
		void import("canvas-confetti").then(({ default: confetti }) => {
			const burst = () => {
				confetti({
					particleCount: 52,
					spread: 58,
					origin: { y: 0.72 },
					scalar: 1.05,
					ticks: 220,
				});
			};
			burst();
			setTimeout(burst, 200);
			setTimeout(() => {
				confetti({ particleCount: 85, angle: 55, spread: 62, origin: { x: 0, y: 0.65 }, startVelocity: 42 });
				confetti({ particleCount: 85, angle: 125, spread: 62, origin: { x: 1, y: 0.65 }, startVelocity: 42 });
			}, 400);
		});
	}, []);

	const submit = useCallback(() => {
		let c = 0;
		for (const q of test.questions) {
			if (choice[q.id] === q.correctIndex) c++;
		}
		const ok = c >= needCorrect;
		setPassed(ok);
		setSubmitted(true);
		if (ok) fireConfetti();
	}, [choice, fireConfetti, needCorrect, test.questions]);

	const reset = useCallback(() => {
		setSubmitted(false);
		setPassed(null);
		setChoice(Object.fromEntries(test.questions.map((q) => [q.id, null] as const)));
	}, [test.questions]);

	return (
		<div className="space-y-8">
			<header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
				<p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Финален тест</p>
				<h1 className="mt-1 text-2xl font-semibold text-slate-900">{courseTitle}</h1>
				<p className="mt-2 text-sm text-slate-600">
					{total} въпроса с по четири възможни отговора. Маркирайте един отговор на въпрос. Успешно преминаване:{" "}
					<strong className="text-slate-900">поне {needCorrect} верни</strong> ({passPercent}% от общия брой). Можете да
					предадете и с непопълнени въпроси — <strong className="text-slate-900">без отговор се броят като грешни</strong>.
				</p>
			</header>

			{!submitted && (
				<ol className="space-y-6">
					{test.questions.map((q, idx) => (
						<li
							key={q.id}
							className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm scroll-mt-24"
						>
							<p className="text-sm font-medium text-slate-900">
								{idx + 1}. {q.text}
							</p>
							<fieldset className="mt-3 space-y-2 border-0 p-0">
								<legend className="sr-only">Отговори на въпрос {idx + 1}</legend>
								{q.options.map((label, i) => (
									<label
										key={i}
										className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm text-slate-800 hover:bg-slate-50 has-[:checked]:border-emerald-400 has-[:checked]:bg-emerald-50/60"
									>
										<input
											type="radio"
											name={q.id}
											checked={choice[q.id] === i}
											onChange={() => setChoice((prev) => ({ ...prev, [q.id]: i }))}
											className="mt-1"
										/>
										<span>{label}</span>
									</label>
								))}
							</fieldset>
						</li>
					))}
				</ol>
			)}

			{!submitted && (
				<div className="sticky bottom-4 z-10 flex justify-center">
					<button
						type="button"
						onClick={submit}
						className="rounded-full bg-emerald-800 px-8 py-3 text-sm font-semibold text-white shadow-lg hover:opacity-95"
					>
						Предай теста
					</button>
				</div>
			)}

			{submitted && passed === true && score != null && (
				<div
					className="rounded-2xl border-2 border-emerald-400 bg-emerald-50/90 p-6 text-center shadow-md"
					role="status"
				>
					<p className="text-4xl" aria-hidden>
						🎉
					</p>
					<p className="mt-2 text-lg font-semibold text-emerald-950">Браво — преминахте теста!</p>
					<p className="mt-1 text-sm text-emerald-900">
						Резултат: <strong>{score}</strong> / {total} верни отговора (минимум {needCorrect}).
					</p>
					<button
						type="button"
						onClick={reset}
						className="mt-5 rounded-full border border-emerald-700 bg-white px-5 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100/80"
					>
						Реши отново
					</button>
				</div>
			)}

			{submitted && passed === false && score != null && (
				<div
					className="animate-subtle-shake rounded-2xl border-2 border-slate-400 bg-slate-100 p-6 text-center shadow-md"
					role="alert"
				>
					<p className="text-4xl" aria-hidden>
						📚
					</p>
					<p className="mt-2 text-lg font-semibold text-slate-900">Не достигнахте минимума за успех</p>
					<p className="mt-1 text-sm text-slate-700">
						Имате <strong>{score}</strong> / {total} верни. Нужни са поне <strong>{needCorrect}</strong>. Прегледайте лекциите и
						опитайте пак.
					</p>
					<button
						type="button"
						onClick={reset}
						className="mt-5 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
					>
						Нов опит
					</button>
				</div>
			)}

			{submitted && (
				<details className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800 shadow-sm">
					<summary className="cursor-pointer font-medium text-slate-900">Преглед на отговорите</summary>
					<ol className="mt-4 space-y-4">
						{test.questions.map((q, idx) => {
							const sel = choice[q.id];
							const ok = sel === q.correctIndex;
							return (
								<li key={q.id} className="border-b border-slate-100 pb-3 last:border-0">
									<p className="font-medium text-slate-900">
										{idx + 1}. {q.text}
									</p>
									<p className={ok ? "mt-1 text-emerald-800" : "mt-1 text-red-800"}>
										{ok ? "Верен отговор." : "Грешен или липсващ — верният е маркиран по-долу."}
									</p>
									<ul className="mt-2 space-y-1 text-slate-700">
										{q.options.map((label, i) => (
											<li
												key={i}
												className={
													i === q.correctIndex
														? "font-medium text-emerald-900"
														: sel === i && i !== q.correctIndex
															? "text-red-800 line-through"
															: ""
												}
											>
												{i + 1}) {label}
											</li>
										))}
									</ul>
								</li>
							);
						})}
					</ol>
				</details>
			)}
		</div>
	);
}
