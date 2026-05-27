import { Link, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { fetchCoursesFromNext } from "../../lib/api";
import { courseBySlug, type CourseRow } from "../../lib/courses";
import { getCourseCatalogCached } from "../../lib/courseCatalogCache";
import { moduleLine, strings } from "../../lib/strings";

export default function AcademyCourseScreen() {
	const { slug } = useLocalSearchParams<{ slug: string }>();
	const { locale } = useLanguage();
	const s = strings(locale);
	const { token, ready } = useAuth();
	const [course, setCourse] = useState<CourseRow | undefined>(undefined);
	const [loading, setLoading] = useState(true);

	const slugStr = String(slug ?? "");

	const resolve = useCallback(async () => {
		setLoading(true);
		const cacheKey = token ?? "anon";
		try {
			const list = await getCourseCatalogCached(cacheKey, () => fetchCoursesFromNext(token));
			setCourse(list.find((c) => c.slug === slugStr));
		} catch {
			setCourse(courseBySlug(slugStr));
		} finally {
			setLoading(false);
		}
	}, [slugStr, token]);

	useEffect(() => {
		if (!ready) return;
		void resolve();
	}, [ready, resolve]);

	if (!ready || loading) {
		return (
			<View style={styles.center}>
				<Stack.Screen options={{ title: s.academy.header }} />
				<ActivityIndicator size="large" color="#1F4D2C" />
			</View>
		);
	}

	if (!course) {
		return (
			<View style={styles.center}>
				<Stack.Screen options={{ title: s.academy.notFound }} />
				<Text style={styles.notFoundTitle}>{s.academy.notFound}</Text>
				<Link href="/academy" asChild>
					<Pressable style={styles.linkBtn}>
						<Text style={styles.linkText}>{s.academy.backList}</Text>
					</Pressable>
				</Link>
			</View>
		);
	}

	const title = locale === "bg" ? course.title.bg : course.title.en;
	const desc = locale === "bg" ? course.description.bg : course.description.en;

	return (
		<ScrollView contentContainerStyle={styles.scroll} style={styles.flex}>
			<Stack.Screen options={{ title }} />
			<Text style={styles.kicker}>{s.academy.kicker}</Text>
			<Text style={styles.title}>{title}</Text>
			<Text style={styles.meta}>{moduleLine(locale, course.modules)}</Text>
			<Text style={styles.body}>{desc}</Text>
			<Text style={styles.section}>{s.academy.lectures}</Text>
			{course.lectures.map((lec) => {
				const lt = locale === "bg" ? lec.title.bg : lec.title.en;
				const sum = locale === "bg" ? lec.summary.bg : lec.summary.en;
				return (
					<View key={lec.id} style={styles.lecture}>
						<Text style={styles.lectureTitle}>{lt}</Text>
						<Text style={styles.lectureSum}>{sum}</Text>
					</View>
				);
			})}
			<Link href="/academy" asChild>
				<Pressable style={styles.backWrap}>
					<Text style={styles.back}>{s.academy.backList}</Text>
				</Pressable>
			</Link>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1, backgroundColor: "#F8F6F1" },
	scroll: { paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 40 },
	kicker: {
		fontSize: 11,
		fontWeight: "700",
		color: "#1F4D2C",
		textTransform: "uppercase",
		letterSpacing: 1,
	},
	title: { marginTop: 6, fontSize: 24, fontWeight: "800", color: "#0f172a" },
	meta: { marginTop: 6, fontSize: 14, fontWeight: "600", color: "#1F4D2C" },
	body: { marginTop: 12, fontSize: 15, lineHeight: 22, color: "#475569" },
	section: { marginTop: 22, fontSize: 16, fontWeight: "800", color: "#0f172a" },
	lecture: {
		marginTop: 12,
		padding: 14,
		borderRadius: 14,
		backgroundColor: "rgba(255,255,255,0.95)",
		borderWidth: 1,
		borderColor: "rgba(10,10,10,0.06)",
	},
	lectureTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
	lectureSum: { marginTop: 6, fontSize: 14, lineHeight: 20, color: "#64748b" },
	backWrap: { marginTop: 28, alignSelf: "flex-start" },
	back: { fontSize: 15, fontWeight: "700", color: "#1F4D2C" },
	center: { flex: 1, backgroundColor: "#F8F6F1", padding: 24, justifyContent: "center" },
	notFoundTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
	linkBtn: { marginTop: 16 },
	linkText: { fontSize: 15, color: "#1F4D2C", fontWeight: "700" },
});
