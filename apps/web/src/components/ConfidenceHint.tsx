"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

type ConfidenceHintProps = {
	/** Display label, e.g. "Strong signal" */
	label: string;
	className?: string;
	labelClassName?: string;
};

export function ConfidenceHint({ label, className, labelClassName }: ConfidenceHintProps) {
	const t = useTranslations("Confidence");
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLSpanElement>(null);
	const panelId = useId();

	useEffect(() => {
		if (!open) return;
		const onPointerDown = (e: PointerEvent) => {
			if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	return (
		<span ref={rootRef} className={`relative inline-flex items-center gap-1 ${className ?? ""}`}>
			<span className={labelClassName}>{label}</span>
			<button
				type="button"
				className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-ink/20 bg-ink/[0.04] text-[10px] font-semibold leading-none text-ink/55 transition-colors hover:border-ink/35 hover:text-ink/80"
				aria-expanded={open}
				aria-controls={panelId}
				aria-label={t("hintAria")}
				onClick={() => setOpen((v) => !v)}
			>
				?
			</button>
			{open ? (
				<span
					id={panelId}
					role="tooltip"
					className="absolute left-0 top-full z-50 mt-1.5 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-ink/10 bg-white px-3 py-2.5 text-left text-[11px] leading-relaxed text-ink/75 shadow-lg"
				>
					<strong className="mb-1 block text-[11px] font-medium text-ink">{t("hintTitle")}</strong>
					{t("hintBody")}
					<Link
						href="/methodology"
						className="mt-2 inline-block font-medium text-forest-700 underline underline-offset-2"
						onClick={() => setOpen(false)}
					>
						{t("methodologyLink")}
					</Link>
				</span>
			) : null}
		</span>
	);
}
