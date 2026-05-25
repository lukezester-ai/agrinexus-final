import Link from "next/link";
import { ApiStatus } from "@/components/api-status";
import { SimpleAskPanel } from "@/components/simple-ask-panel";

export const dynamic = "force-dynamic";

export default function Home() {
	return (
		<main className="mx-auto max-w-2xl px-6 py-16">
			<p className="text-sm font-medium uppercase tracking-wide text-emerald-800">AgriNexus · работен плот</p>
			<h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">За бизнес потребител</h1>
			<p className="mt-3 text-slate-600">
				Тук няма нужда да разбирате <strong>RAG</strong>, <strong>LLM</strong> или <strong>LangGraph</strong>. Това са технически
				етикети зад кулисите. За вас има три прости неща:
			</p>
			<ul className="mt-4 list-inside list-disc space-y-2 text-slate-700">
				<li>
					<strong>Питай по-долу</strong> — изкуствен интелект маршрутизира въпроса ви към „пазар“, „време“, „обучение“ и т.н.
				</li>
				<li>
					<strong>Здраве на API слоя</strong> — малък технически индикатор (Python/FastAPI на порт 8000).
				</li>
				<li>
					<strong>Пълният маркетингов сайт</strong> с графики и още страници — отделен локален сървър (порт 3456).
				</li>
			</ul>

			<SimpleAskPanel />

			<p className="mt-4 text-xs text-slate-500">
				За полето „Питай“ трябва в <strong>трети терминал</strong>, от <strong>корена на репото</strong> (папката с{" "}
				<code className="rounded bg-slate-100 px-1">package.json</code> на целия проект):{" "}
				<code className="rounded bg-slate-100 px-1">npm run dev</code> → порт <strong>3456</strong> и ключ{" "}
				<code className="rounded bg-slate-100 px-1">MISTRAL_API_KEY</code> в <code className="rounded bg-slate-100 px-1">.env</code> там.
				По желание: <code className="rounded bg-slate-100 px-1">AGN_MARKETING_ORIGIN</code> в <code className="rounded bg-slate-100 px-1">apps/web/.env.local</code> ако ползвате друг адрес.
			</p>

			<div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<h2 className="text-sm font-semibold text-slate-800">Състояние на API слоя (FastAPI)</h2>
				<ApiStatus />
			</div>

			<nav className="mt-10 flex flex-wrap gap-4 text-sm font-medium text-emerald-800">
				<a
					className="underline underline-offset-4 hover:text-emerald-950"
					href="http://127.0.0.1:3456/"
					target="_blank"
					rel="noreferrer"
				>
					Маркетингов сайт (порт 3456)
				</a>
				<Link className="underline underline-offset-4 hover:text-emerald-950" href="/login">
					Вход (скелет)
				</Link>
				<Link className="underline underline-offset-4 hover:text-emerald-950" href="/academy">
					Академия + лаборатория
				</Link>
				<a className="underline underline-offset-4 hover:text-emerald-950" href="http://127.0.0.1:3456/academy.html" target="_blank" rel="noreferrer">
					Пълна библиотека (статична)
				</a>
			</nav>
		</main>
	);
}
