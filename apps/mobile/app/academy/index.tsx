import { Link, Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
	ActivityIndicator,
	FlatList,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { fetchCoursesFromNext } from "../../lib/api";
import { COURSES, type CourseRow } from "../../lib/courses";
import { getCourseCatalogCached } from "../../lib/courseCatalogCache";
import { moduleLine, strings } from "../../lib/strings";

export default function AcademyIndexScreen() {
	const { locale } = useLanguage();
	const s = strings(locale);
	const { token, ready } = useAuth();
	const [rows, setRows] = useState<CourseRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [fromOffline, setFromOffline] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setError(null);
		setLoading(true);
		const cacheKey = token ?? "anon";
		try {
			const data = await getCourseCatalogCached(cacheKey, () => fetchCoursesFromNext(token));
			setRows(data);
			setFromOffline(false);
		} catch (e) {
			setRows(COURSES);
			setFromOffline(true);
			setError(e instanceof Error ? e.message : "error");
		} finally {
			setLoading(false);
		}
	}, [token]);

	useEffect(() => {
		if (!ready) return;
		void load();
	}, [ready, load]);

	if (!ready) {
		return (
			<View style={styles.screen}>
				<Stack.Screen options={{ title: s.academy.header }} />
				<View style={styles.center}>
					<ActivityIndicator size="large" color="#1F4D2C" />
				</View>
			</View>
		);
	}

	return (
		<View style={styles.screen}>
			<Stack.Screen options={{ title: s.academy.header }} />
			<FlatList
				data={rows}
				keyExtractor={(item) => item.slug}
				contentContainerStyle={styles.list}
				refreshing={loading}
				onRefresh={() => void load()}
				ListHeaderComponent={
					<View style={styles.headerBlock}>
						<Text style={styles.kicker}>{s.academy.kicker}</Text>
						<Text style={styles.heading}>{s.academy.heading}</Text>
						<Text style={styles.intro}>{s.academy.intro}</Text>
						{fromOffline && <Text style={styles.banner}>{s.academy.offlineHint}</Text>}
						{error && fromOffline && (
							<Text style={styles.errSmall}>
								{s.academy.errorTitle}: {error}
							</Text>
						)}
						<Text style={styles.sectionTitle}>{s.academy.coursesTitle}</Text>
					</View>
				}
				ListFooterComponent={
					<View>
						{error && !fromOffline ? (
							<Pressable style={styles.retry} onPress={() => void load()}>
								<Text style={styles.retryText}>{s.academy.retry}</Text>
							</Pressable>
						) : null}
						<Link href="/" asChild>
							<Pressable style={styles.footerLink}>
								<Text style={styles.footerText}>← {s.home.title}</Text>
							</Pressable>
						</Link>
					</View>
				}
				renderItem={({ item }) => <CourseCard course={item} locale={locale} openLabel={s.academy.openCourse} />}
				ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
			/>
		</View>
	);
}

function CourseCard({
	course,
	locale,
	openLabel,
}: {
	course: CourseRow;
	locale: "en" | "bg";
	openLabel: string;
}) {
	const title = locale === "bg" ? course.title.bg : course.title.en;
	const desc = locale === "bg" ? course.description.bg : course.description.en;
	const mod = moduleLine(locale, course.modules);

	return (
		<Link href={`/academy/${course.slug}`} asChild>
			<Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
				<Text style={styles.cardTitle}>{title}</Text>
				<Text style={styles.cardMeta}>{mod}</Text>
				<Text style={styles.cardDesc}>{desc}</Text>
				<Text style={styles.cardCta}>{openLabel} →</Text>
			</Pressable>
		</Link>
	);
}

const styles = StyleSheet.create({
	screen: { flex: 1, backgroundColor: "#F8F6F1" },
	center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
	list: { paddingHorizontal: 20, paddingBottom: 32 },
	headerBlock: { paddingTop: 8, paddingBottom: 8 },
	kicker: {
		fontSize: 12,
		fontWeight: "700",
		color: "#1F4D2C",
		textTransform: "uppercase",
		letterSpacing: 1,
	},
	heading: {
		marginTop: 8,
		fontSize: 28,
		fontWeight: "700",
		color: "#0f172a",
	},
	intro: {
		marginTop: 10,
		fontSize: 15,
		lineHeight: 22,
		color: "#475569",
	},
	banner: {
		marginTop: 12,
		padding: 10,
		borderRadius: 10,
		backgroundColor: "rgba(184, 122, 61, 0.15)",
		color: "#5c3d1a",
		fontSize: 13,
		lineHeight: 18,
	},
	errSmall: { marginTop: 8, fontSize: 12, color: "#b45309" },
	sectionTitle: {
		marginTop: 22,
		fontSize: 17,
		fontWeight: "700",
		color: "#0f172a",
	},
	card: {
		backgroundColor: "rgba(255,255,255,0.9)",
		borderRadius: 16,
		padding: 16,
		borderWidth: 1,
		borderColor: "rgba(10,10,10,0.06)",
	},
	cardPressed: { opacity: 0.92, transform: [{ scale: 0.995 }] },
	cardTitle: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
	cardMeta: { marginTop: 4, fontSize: 13, fontWeight: "600", color: "#1F4D2C" },
	cardDesc: { marginTop: 8, fontSize: 14, lineHeight: 20, color: "#475569" },
	cardCta: { marginTop: 12, fontSize: 14, fontWeight: "700", color: "#1F4D2C" },
	retry: {
		marginHorizontal: 20,
		marginBottom: 8,
		padding: 12,
		alignItems: "center",
		borderRadius: 12,
		backgroundColor: "#1F4D2C",
	},
	retryText: { color: "#fff", fontWeight: "700" },
	footerLink: { paddingHorizontal: 20, paddingVertical: 16 },
	footerText: { fontSize: 14, color: "#1F4D2C", fontWeight: "600" },
});
