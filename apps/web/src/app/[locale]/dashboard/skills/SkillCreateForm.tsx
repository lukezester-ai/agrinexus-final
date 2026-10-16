"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { supabase } from "@/lib/supabase";
import type { SkillSuggestion } from "@/lib/ai-skill-assist";
import {
	SKILL_MAX_GUARDRAILS,
	SKILL_MAX_STEPS,
	SKILL_NAME_MAX_LENGTH,
	SKILL_SOURCE_MAX_LENGTH,
	SKILL_SOURCE_MIN_LENGTH,
	SKILL_TEXT_MAX_LENGTH,
	type SkillStatus,
	type SkillStep,
} from "@/lib/skills";

const copy = {
	en: {
		assistTitle: "Describe what you want",
		assistHint:
			"Write the routine you need in your own words. Do not include confidential information. Nothing is saved until you save it.",
		assistPlaceholder:
			"Every time a buyer asks whether our sunflower oil is Halal, I want a fixed routine for checking the paperwork and replying…",
		assistGenerate: "Build playbook",
		assistGenerating: "Building…",
		assistApply: "Use this draft",
		assistPreview: "Review before using",
		manual: "Or write it yourself",
		name: "Name",
		description: "What it achieves",
		whenToUse: "When to use it",
		steps: "Steps",
		stepTitle: "Step",
		stepDetail: "What to do",
		addStep: "Add step",
		removeStep: "Remove",
		guardrails: "Guardrails",
		guardrailsHint: "One per line. At most 6.",
		draft: "Save as draft",
		activate: "Save and activate",
		saving: "Saving…",
		errors: {
			forbidden: "Your role in this organization cannot create playbooks.",
			source_text_must_be_20_to_4000_characters: `Write between ${SKILL_SOURCE_MIN_LENGTH} and ${SKILL_SOURCE_MAX_LENGTH} characters.`,
			skill_assistant_not_configured:
				"The playbook assistant is not configured. You can still write the playbook manually below.",
			skill_assistant_failed: "The assistant could not build a playbook. Try again or write it manually.",
			skill_assistant_unavailable: "The assistant is unreachable right now. Write the playbook manually below.",
			invalid_organization: "Organization could not be resolved.",
		},
	},
	bg: {
		assistTitle: "Опишете какво искате",
		assistHint:
			"Напишете с ваши думи процедурата, която ви трябва. Не включвайте поверителна информация. Нищо не се записва, докато не натиснете запис.",
		assistPlaceholder:
			"Всеки път, когато купувач пита дали слънчогледовото масло е Halal, искам фиксирана процедура за проверка на документите и отговор…",
		assistGenerate: "Създай playbook",
		assistGenerating: "Създаване…",
		assistApply: "Използвай черновата",
		assistPreview: "Прегледайте преди да използвате",
		manual: "Или го напишете сами",
		name: "Име",
		description: "Какво постига",
		whenToUse: "Кога се използва",
		steps: "Стъпки",
		stepTitle: "Стъпка",
		stepDetail: "Какво да се направи",
		addStep: "Добави стъпка",
		removeStep: "Премахни",
		guardrails: "Ограничения",
		guardrailsHint: "По едно на ред. Най-много 6.",
		draft: "Запази като чернова",
		activate: "Запази и активирай",
		saving: "Запис…",
		errors: {
			forbidden: "Ролята ви в тази организация не позволява създаване на playbook.",
			source_text_must_be_20_to_4000_characters: `Напишете между ${SKILL_SOURCE_MIN_LENGTH} и ${SKILL_SOURCE_MAX_LENGTH} символа.`,
			skill_assistant_not_configured:
				"Асистентът за playbook не е конфигуриран. Все още можете да го напишете ръчно по-долу.",
			skill_assistant_failed: "Асистентът не успя да създаде playbook. Опитайте отново или го напишете ръчно.",
			skill_assistant_unavailable: "Асистентът е недостъпен в момента. Напишете playbook ръчно по-долу.",
			invalid_organization: "Организацията не можа да бъде определена.",
		},
	},
	ar: {
		assistTitle: "اكتب ما تريده",
		assistHint: "اكتب الإجراء الذي تحتاجه بكلماتك. لا تُدرج معلومات سرية. لا يتم الحفظ قبل الضغط على حفظ.",
		assistPlaceholder: "كلما سأل مشترٍ إن كان زيت دوار الشمس حلالًا، أريد إجراءً ثابتًا للتحقق من المستندات والرد…",
		assistGenerate: "أنشئ الدليل",
		assistGenerating: "جارٍ الإنشاء…",
		assistApply: "استخدم المسودة",
		assistPreview: "راجع قبل الاستخدام",
		manual: "أو اكتبه بنفسك",
		name: "الاسم",
		description: "ما يحققه",
		whenToUse: "متى يُستخدم",
		steps: "الخطوات",
		stepTitle: "الخطوة",
		stepDetail: "ما يجب فعله",
		addStep: "أضف خطوة",
		removeStep: "إزالة",
		guardrails: "الضوابط",
		guardrailsHint: "واحد في كل سطر. بحد أقصى 6.",
		draft: "حفظ كمسودة",
		activate: "حفظ وتفعيل",
		saving: "جارٍ الحفظ…",
		errors: {
			forbidden: "دورك في هذه المنظمة لا يسمح بإنشاء الأدلة.",
			source_text_must_be_20_to_4000_characters: `اكتب بين ${SKILL_SOURCE_MIN_LENGTH} و${SKILL_SOURCE_MAX_LENGTH} حرفًا.`,
			skill_assistant_not_configured: "مساعد الدليل غير مُهيأ. يمكنك كتابة الدليل يدويًا أدناه.",
			skill_assistant_failed: "لم يتمكن المساعد من إنشاء دليل. أعد المحاولة أو اكتبه يدويًا.",
			skill_assistant_unavailable: "المساعد غير متاح حاليًا. اكتب الدليل يدويًا أدناه.",
			invalid_organization: "تعذّر تحديد المنظمة.",
		},
	},
};

type FormCopy = (typeof copy)["en"];

function texts(locale: string): FormCopy {
	if (locale === "bg") return copy.bg as FormCopy;
	if (locale === "ar") return copy.ar as FormCopy;
	return copy.en;
}

const field =
	"w-full border border-white/15 bg-transparent px-3 py-2 text-sm text-white outline-none focus:border-white/40";

export function SkillCreateForm({
	locale,
	organizationId,
}: {
	locale: string;
	organizationId: string;
	userId: string;
}) {
	const router = useRouter();
	const t = texts(locale);
	const [assistText, setAssistText] = useState("");
	const [assisting, setAssisting] = useState(false);
	const [suggestion, setSuggestion] = useState<SkillSuggestion | null>(null);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [whenToUse, setWhenToUse] = useState("");
	const [steps, setSteps] = useState<SkillStep[]>([{ title: "", detail: "" }]);
	const [guardrails, setGuardrails] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	function errorText(code: string): string {
		const table = t.errors as Record<string, string>;
		return table[code] ?? code;
	}

	async function generateSuggestion() {
		setAssisting(true);
		setSuggestion(null);
		setError(null);
		try {
			const response = await fetch("/api/skills/assist", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ organizationId, sourceText: assistText, locale }),
			});
			const data = (await response.json()) as { suggestion?: SkillSuggestion; error?: string };
			if (!response.ok || !data.suggestion) {
				setError(errorText(data.error || "skill_assistant_failed"));
				return;
			}
			setSuggestion(data.suggestion);
		} catch {
			setError(errorText("skill_assistant_unavailable"));
		} finally {
			setAssisting(false);
		}
	}

	function applySuggestion() {
		if (!suggestion) return;
		setName(suggestion.name);
		setDescription(suggestion.description);
		setWhenToUse(suggestion.whenToUse);
		setSteps(suggestion.steps.length ? suggestion.steps : [{ title: "", detail: "" }]);
		setGuardrails(suggestion.guardrails.join("\n"));
		setSuggestion(null);
	}

	function updateStep(index: number, patch: Partial<SkillStep>) {
		setSteps((current) => current.map((step, i) => (i === index ? { ...step, ...patch } : step)));
	}

	async function save(initialStatus: SkillStatus) {
		const cleanSteps = steps
			.map((step) => ({ title: step.title.trim(), detail: step.detail.trim() }))
			.filter((step) => step.title || step.detail);
		if (!name.trim()) {
			setError(t.name);
			return;
		}
		if (cleanSteps.length === 0) {
			setError(t.steps);
			return;
		}

		setSaving(true);
		setError(null);
		const cleanGuardrails = guardrails
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean)
			.slice(0, SKILL_MAX_GUARDRAILS);

		const { error: commandError } = await supabase.rpc("create_organization_skill_v1", {
			p_organization_id: organizationId,
			p_name: name.trim(),
			p_description: description.trim(),
			p_when_to_use: whenToUse.trim(),
			p_steps: cleanSteps,
			p_guardrails: cleanGuardrails,
			p_initial_status: initialStatus,
			p_source_text: assistText.trim(),
		});

		if (commandError) {
			setSaving(false);
			setError(commandError.message);
			return;
		}

		router.push("/dashboard/skills");
		router.refresh();
	}

	return (
		<form
			className="flex max-w-xl flex-col gap-4"
			onSubmit={(e) => {
				e.preventDefault();
				void save("draft");
			}}
		>
			<section className="border border-white/15 p-4">
				<h2 className="text-sm text-white">{t.assistTitle}</h2>
				<p className="mt-1 text-xs text-white/55">{t.assistHint}</p>
				<textarea
					className={`${field} mt-3`}
					rows={4}
					minLength={SKILL_SOURCE_MIN_LENGTH}
					maxLength={SKILL_SOURCE_MAX_LENGTH}
					placeholder={t.assistPlaceholder}
					value={assistText}
					onChange={(e) => setAssistText(e.target.value)}
				/>
				<button
					type="button"
					disabled={assisting || assistText.trim().length < SKILL_SOURCE_MIN_LENGTH}
					onClick={() => void generateSuggestion()}
					className="mt-3 border border-white/15 px-3 py-2 text-xs text-white/85 disabled:opacity-50 hover:border-white/40"
				>
					{assisting ? t.assistGenerating : t.assistGenerate}
				</button>
				{suggestion ? (
					<div className="mt-3 border border-white/15 p-3 text-xs text-white/70">
						<p className="text-white">{t.assistPreview}</p>
						<p className="mt-2">
							<strong>{suggestion.name}</strong>
						</p>
						<p className="mt-1">{suggestion.description}</p>
						<p className="mt-1 text-white/50">{suggestion.whenToUse}</p>
						<ol className="mt-2 list-decimal space-y-1 ps-4">
							{suggestion.steps.map((step, index) => (
								<li key={`${step.title}-${index}`}>
									<span className="text-white/85">{step.title}</span> — {step.detail}
								</li>
							))}
						</ol>
						{suggestion.guardrails.length ? (
							<ul className="mt-2 list-disc space-y-1 ps-4 text-white/50">
								{suggestion.guardrails.map((item) => (
									<li key={item}>{item}</li>
								))}
							</ul>
						) : null}
						<button
							type="button"
							onClick={applySuggestion}
							className="mt-3 border border-white/15 px-3 py-2 text-white/85 hover:border-white/40"
						>
							{t.assistApply}
						</button>
					</div>
				) : null}
			</section>

			<p className="text-[11px] tracking-[0.18em] text-white/45">{t.manual}</p>

			<label className="flex flex-col gap-1.5 text-xs font-medium text-white/70">
				{t.name}
				<input
					className={field}
					required
					maxLength={SKILL_NAME_MAX_LENGTH}
					value={name}
					onChange={(e) => setName(e.target.value)}
				/>
			</label>
			<label className="flex flex-col gap-1.5 text-xs font-medium text-white/70">
				{t.description}
				<textarea
					className={field}
					rows={2}
					maxLength={SKILL_TEXT_MAX_LENGTH}
					value={description}
					onChange={(e) => setDescription(e.target.value)}
				/>
			</label>
			<label className="flex flex-col gap-1.5 text-xs font-medium text-white/70">
				{t.whenToUse}
				<textarea
					className={field}
					rows={2}
					maxLength={SKILL_TEXT_MAX_LENGTH}
					value={whenToUse}
					onChange={(e) => setWhenToUse(e.target.value)}
				/>
			</label>

			<div className="flex flex-col gap-3">
				<span className="text-xs font-medium text-white/70">{t.steps}</span>
				{steps.map((step, index) => (
					<div key={`step-${index}`} className="border border-white/15 p-3">
						<input
							className={field}
							placeholder={`${t.stepTitle} ${index + 1}`}
							maxLength={SKILL_NAME_MAX_LENGTH}
							value={step.title}
							onChange={(e) => updateStep(index, { title: e.target.value })}
						/>
						<textarea
							className={`${field} mt-2`}
							rows={2}
							placeholder={t.stepDetail}
							maxLength={SKILL_TEXT_MAX_LENGTH}
							value={step.detail}
							onChange={(e) => updateStep(index, { detail: e.target.value })}
						/>
						{steps.length > 1 ? (
							<button
								type="button"
								onClick={() => setSteps((current) => current.filter((_, i) => i !== index))}
								className="mt-2 text-[11px] text-white/45 hover:text-white"
							>
								{t.removeStep}
							</button>
						) : null}
					</div>
				))}
				{steps.length < SKILL_MAX_STEPS ? (
					<button
						type="button"
						onClick={() => setSteps((current) => [...current, { title: "", detail: "" }])}
						className="self-start border border-white/15 px-3 py-2 text-xs text-white/85 hover:border-white/40"
					>
						{t.addStep}
					</button>
				) : null}
			</div>

			<label className="flex flex-col gap-1.5 text-xs font-medium text-white/70">
				{t.guardrails}
				<textarea
					className={field}
					rows={3}
					value={guardrails}
					onChange={(e) => setGuardrails(e.target.value)}
				/>
				<span className="font-normal text-white/45">{t.guardrailsHint}</span>
			</label>

			{error ? <p className="text-sm text-red-800">{error}</p> : null}
			<div className="flex gap-2">
				<button
					type="submit"
					disabled={saving}
					className="border border-white/15 px-4 py-2.5 text-[13px] text-white/85 disabled:opacity-50"
				>
					{saving ? t.saving : t.draft}
				</button>
				<button
					type="button"
					disabled={saving}
					onClick={() => void save("active")}
					className="border border-white/15 px-4 py-2.5 text-[13px] text-white/85 hover:border-white/40 disabled:opacity-50"
				>
					{saving ? t.saving : t.activate}
				</button>
			</div>
		</form>
	);
}
