"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

type Field = {
	id: string;
	name: string;
	hectares: number;
	crop: string;
	status: string;
};

const CULTURES = ['Пшеница', 'Царевица', 'Слънчоглед', 'Ечемик', 'Рапица', 'Домати', 'Краставици', 'Лавандула', 'Лозя', 'Друго'];

export default function FieldsManager({ initialFields, locale }: { initialFields: Field[], locale: string }) {
	const { user } = useAuth();
	const [fields, setFields] = useState<Field[]>(initialFields);
	const [isAdding, setIsAdding] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	// Форма
	const [name, setName] = useState("");
	const [hectares, setHectares] = useState("");
	const [crop, setCrop] = useState(CULTURES[0]);

	const handleAdd = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!user || !name || !hectares) return;
		
		setIsSaving(true);
		const newField = {
			user_id: user.id,
			name,
			hectares: Number(hectares),
			crop,
			status: "healthy",
		};

		const { data, error } = await supabase.from("fields").insert(newField).select().single();
		
		if (!error && data) {
			setFields([...fields, data]);
			setName("");
			setHectares("");
			setIsAdding(false);
		} else {
			alert("Грешка при добавяне на полето: " + error?.message);
		}
		setIsSaving(false);
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Сигурни ли сте, че искате да изтриете това поле?")) return;
		
		const { error } = await supabase.from("fields").delete().eq("id", id);
		if (!error) {
			setFields(fields.filter(f => f.id !== id));
		} else {
			alert("Грешка при изтриване: " + error.message);
		}
	};

	return (
		<div className="max-w-4xl mx-auto py-8">
			<div className="flex items-center justify-between mb-8">
				<div>
					<h1 className="text-2xl font-serif text-slate-900">{locale === 'bg' ? 'Моите Полета' : 'My Fields'}</h1>
					<p className="text-sm text-slate-500 mt-1">{locale === 'bg' ? 'Управление на блоковете земя в стопанството' : 'Manage your farm blocks'}</p>
				</div>
				<button 
					onClick={() => setIsAdding(!isAdding)}
					className="bg-forest-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-forest-800 transition-colors"
				>
					{isAdding ? (locale === 'bg' ? 'Отказ' : 'Cancel') : (locale === 'bg' ? '+ Добави поле' : '+ Add field')}
				</button>
			</div>

			{isAdding && (
				<form onSubmit={handleAdd} className="bg-white/80 backdrop-blur border border-ink/10 rounded-2xl p-6 mb-8 shadow-sm">
					<h2 className="text-lg font-medium mb-4">{locale === 'bg' ? 'Ново поле' : 'New field'}</h2>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
						<label className="block text-sm">
							<span className="text-slate-600 mb-1 block">{locale === 'bg' ? 'Име / Номер (пр. А-204)' : 'Name / Block'}</span>
							<input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2.5 outline-none focus:border-forest-700" placeholder="A-204" />
						</label>
						<label className="block text-sm">
							<span className="text-slate-600 mb-1 block">{locale === 'bg' ? 'Размер (Хектари)' : 'Size (Hectares)'}</span>
							<input type="number" step="0.1" required value={hectares} onChange={e => setHectares(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2.5 outline-none focus:border-forest-700" placeholder="15.5" />
						</label>
						<label className="block text-sm">
							<span className="text-slate-600 mb-1 block">{locale === 'bg' ? 'Култура' : 'Crop'}</span>
							<select value={crop} onChange={e => setCrop(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2.5 outline-none focus:border-forest-700">
								{CULTURES.map(c => <option key={c} value={c}>{c}</option>)}
							</select>
						</label>
					</div>
					<button type="submit" disabled={isSaving} className="bg-forest-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-forest-800 transition-colors disabled:opacity-50">
						{isSaving ? 'Запазване...' : (locale === 'bg' ? 'Запази полето' : 'Save field')}
					</button>
				</form>
			)}

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{fields.map(f => (
					<div key={f.id} className="bg-white/60 backdrop-blur border border-ink/10 rounded-2xl p-5 shadow-sm relative group">
						<button 
							onClick={() => handleDelete(f.id)}
							className="absolute top-4 right-4 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
							title="Изтрий"
						>
							✕
						</button>
						<div className="flex items-center gap-2.5 mb-3">
							<div className="w-3 h-3 rounded-sm bg-harvest-500"></div>
							<h3 className="font-medium text-slate-900 text-lg">{f.name}</h3>
						</div>
						<div className="flex justify-between items-end">
							<div>
								<div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{locale === 'bg' ? 'Култура' : 'Crop'}</div>
								<div className="font-medium">{f.crop}</div>
							</div>
							<div className="text-right">
								<div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{locale === 'bg' ? 'Площ' : 'Area'}</div>
								<div className="font-medium text-forest-700">{f.hectares} {locale === 'bg' ? 'ха' : 'ha'}</div>
							</div>
						</div>
					</div>
				))}

				{fields.length === 0 && !isAdding && (
					<div className="col-span-full text-center py-12 text-slate-500 bg-white/40 rounded-2xl border border-dashed border-ink/20">
						{locale === 'bg' ? 'Нямате добавени полета. Натиснете бутона горе, за да добавите първото си поле!' : 'No fields added yet. Click the button above to add your first field!'}
					</div>
				)}
			</div>
		</div>
	);
}
