import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import FieldsManager from "./FieldsManager";

type PageProps = { params: Promise<{ locale: string }> };

export default async function FieldsPage({ params }: PageProps) {
	const { locale } = await params;
	setRequestLocale(locale);

	const supabase = createClient();
	const { data: { session } } = await supabase.auth.getSession();

	if (!session) {
		redirect(`/${locale}/login`);
	}

	const { data: fields } = await supabase
		.from("fields")
		.select("*")
		.eq("user_id", session.user.id)
		.order("created_at", { ascending: true });

	return (
		<div className="min-h-0 p-4 md:min-h-screen md:p-8">
			<FieldsManager initialFields={fields || []} locale={locale} />
		</div>
	);
}
