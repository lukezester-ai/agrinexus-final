"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SettingsForm({ locale, profile }: { locale: string; profile: { user_id?: string; full_name?: string } | null }) {
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const [fullName, setFullName] = useState(profile?.full_name || "");

	const copy = {
		en: { save: "Save", saving: "Saving...", success: "Saved.", nameLabel: "Display name", namePlaceholder: "Your name" },
		bg: { save: "Запази", saving: "Запазване...", success: "Запазено.", nameLabel: "Показвано име", namePlaceholder: "Вашето име" },
	};
	const c = locale === "bg" ? copy.bg : copy.en;

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!profile?.user_id) return;
		setLoading(true);
		setSuccess(false);
		const { error } = await supabase.from("farm_profiles").update({ full_name: fullName }).eq("user_id", profile.user_id);
		setLoading(false);
		if (!error) {
			setSuccess(true);
			setTimeout(() => setSuccess(false), 3000);
			window.location.reload();
		}
	};

	if (!profile?.user_id) {
		return <p className="text-sm text-white/60">{fullName || "—"}</p>;
	}

	return (
		<form onSubmit={handleSave} className="flex flex-col gap-5">
			<div className="flex flex-col gap-1.5">
				<label className="text-xs text-white/70">{c.nameLabel}</label>
				<input
					type="text"
					value={fullName}
					onChange={(e) => setFullName(e.target.value)}
					placeholder={c.namePlaceholder}
					className="border border-white/15 bg-transparent px-4 py-2.5 text-sm text-white outline-none focus:border-white/40"
					required
				/>
			</div>
			<button
				type="submit"
				disabled={loading}
				className="mt-2 flex w-full items-center justify-center border border-white/15 px-4 py-2.5 text-[13px] text-white/85 hover:border-white/40 disabled:opacity-50"
			>
				{loading ? c.saving : c.save}
			</button>
			{success && (
				<div className="mt-2 rounded-xl bg-semantic-success/10 px-4 py-2.5 text-center text-[11px] font-medium text-semantic-success">
					{c.success}
				</div>
			)}
		</form>
	);
}
