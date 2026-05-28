"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { BreakEvenSettings } from "@/components/break-even/BreakEvenSettings";
import { BriefingConnect } from "@/components/briefing/BriefingConnect";
import { parseBreakEvenInputs } from "@/lib/break-even";
import { parseBriefingPreferences } from "@/lib/briefing-preferences";

export default function SettingsForm({ 
	locale, 
	profile 
}: { 
	locale: string, 
	profile: any 
}) {
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	
	const [fullName, setFullName] = useState(profile?.full_name || "");
	const [region, setRegion] = useState(profile?.region || "");
	const [totalHa, setTotalHa] = useState(profile?.total_ha?.toString() || "");

	const copy = {
		en: {
			save: "Save Changes",
			saving: "Saving...",
			success: "Profile updated successfully.",
			nameLabel: "Full Name",
			namePlaceholder: "e.g. Stefan Ivanov",
			regionLabel: "Region",
			regionPlaceholder: "e.g. Dobrich",
			haLabel: "Total Hectares",
			haPlaceholder: "e.g. 280",
		},
		bg: {
			save: "Запазване на промените",
			saving: "Запазване...",
			success: "Профилът е обновен успешно.",
			nameLabel: "Име и фамилия",
			namePlaceholder: "напр. Стефан Иванов",
			regionLabel: "Регион",
			regionPlaceholder: "напр. Добрич",
			haLabel: "Обща площ (хектари)",
			haPlaceholder: "напр. 280",
		}
	};
	const c = locale === "bg" ? copy.bg : copy.en;

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setSuccess(false);

		const haValue = parseInt(totalHa, 10);

		const { error } = await supabase
			.from("farm_profiles")
			.update({
				full_name: fullName,
				region: region,
				total_ha: isNaN(haValue) ? null : haValue
			})
			.eq("user_id", profile.user_id);

		setLoading(false);
		if (!error) {
			setSuccess(true);
			setTimeout(() => setSuccess(false), 3000);
			// Refresh the page to update the layout sidebar
			window.location.reload();
		} else {
			console.error("Error updating profile", error);
			alert("Failed to update profile");
		}
	};

	return (
		<form onSubmit={handleSave} className="flex flex-col gap-5">
			<div className="flex flex-col gap-1.5">
				<label className="text-xs font-medium text-ink/70">{c.nameLabel}</label>
				<input 
					type="text" 
					value={fullName}
					onChange={(e) => setFullName(e.target.value)}
					placeholder={c.namePlaceholder}
					className="rounded-xl border border-ink/10 bg-white/50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-forest-500 focus:bg-white"
					required
				/>
			</div>

			<div className="flex flex-col gap-1.5">
				<label className="text-xs font-medium text-ink/70">{c.regionLabel}</label>
				<input 
					type="text" 
					value={region}
					onChange={(e) => setRegion(e.target.value)}
					placeholder={c.regionPlaceholder}
					className="rounded-xl border border-ink/10 bg-white/50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-forest-500 focus:bg-white"
					required
				/>
			</div>

			<div className="flex flex-col gap-1.5">
				<label className="text-xs font-medium text-ink/70">{c.haLabel}</label>
				<input 
					type="number" 
					value={totalHa}
					onChange={(e) => setTotalHa(e.target.value)}
					placeholder={c.haPlaceholder}
					min="0"
					className="rounded-xl border border-ink/10 bg-white/50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-forest-500 focus:bg-white"
					required
				/>
			</div>

			<button 
				type="submit" 
				disabled={loading}
				className="mt-2 flex w-full items-center justify-center rounded-xl bg-forest-700 px-4 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
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

export function SettingsFormWithBreakEven({
	locale,
	profile,
}: {
	locale: string;
	profile: {
		user_id: string;
		break_even_inputs?: unknown;
		briefing_preferences?: unknown;
	} | null;
}) {
	const breakEven = parseBreakEvenInputs(profile?.break_even_inputs);
	const briefing = parseBriefingPreferences(profile?.briefing_preferences);
	return (
		<>
			<SettingsForm locale={locale} profile={profile} />
			{profile?.user_id ? (
				<>
					<BreakEvenSettings locale={locale} userId={profile.user_id} initial={breakEven} />
					<BriefingConnect locale={locale} userId={profile.user_id} initial={briefing} />
				</>
			) : null}
		</>
	);
}
