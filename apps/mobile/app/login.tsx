import { Link, Stack, router } from "expo-router";
import { useState } from "react";
import {
	ActivityIndicator,
	Alert,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { strings } from "../lib/strings";

export default function LoginScreen() {
	const { locale } = useLanguage();
	const s = strings(locale);
	const { signIn } = useAuth();
	const [email, setEmail] = useState("");
	const [busy, setBusy] = useState(false);

	async function onSubmit() {
		if (busy) return;
		setBusy(true);
		try {
			await signIn(email);
			router.replace("/academy");
		} catch (e) {
			const msg = e instanceof Error ? e.message : s.login.errorFallback;
			Alert.alert(s.login.errorTitle, msg);
		} finally {
			setBusy(false);
		}
	}

	return (
		<KeyboardAvoidingView
			style={styles.flex}
			behavior={Platform.OS === "ios" ? "padding" : undefined}
		>
			<Stack.Screen options={{ title: s.login.header }} />
			<ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
				<Text style={styles.kicker}>{s.login.kicker}</Text>
				<Text style={styles.title}>{s.login.header}</Text>
				<Text style={styles.body}>{s.login.body}</Text>

				<View style={styles.fieldWrap}>
					<Text style={styles.label}>{s.login.email}</Text>
					<TextInput
						value={email}
						onChangeText={setEmail}
						placeholder={s.login.placeholder}
						keyboardType="email-address"
						autoCapitalize="none"
						autoComplete="email"
						textContentType="emailAddress"
						style={styles.input}
						editable={!busy}
					/>
				</View>

				<Pressable
					style={({ pressed }) => [styles.cta, (pressed || busy) && styles.pressed]}
					onPress={onSubmit}
					disabled={busy}
				>
					{busy ? (
						<View style={styles.row}>
							<ActivityIndicator color="#fff" />
							<Text style={[styles.ctaLabel, { marginLeft: 10 }]}>{s.login.busy}</Text>
						</View>
					) : (
						<Text style={styles.ctaLabel}>{s.login.continue}</Text>
					)}
				</Pressable>

				<Text style={styles.hint}>{s.login.hint}</Text>

				<Link href="/" asChild>
					<Pressable style={styles.backWrap}>
						<Text style={styles.back}>{s.login.back}</Text>
					</Pressable>
				</Link>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1, backgroundColor: "#F8F6F1" },
	scroll: {
		paddingHorizontal: 24,
		paddingTop: 16,
		paddingBottom: 40,
	},
	kicker: {
		fontSize: 12,
		fontWeight: "700",
		color: "#14532d",
		textTransform: "uppercase",
		letterSpacing: 1,
	},
	title: {
		marginTop: 8,
		fontSize: 26,
		fontWeight: "700",
		color: "#0f172a",
	},
	body: {
		marginTop: 10,
		fontSize: 14,
		lineHeight: 22,
		color: "#475569",
	},
	fieldWrap: { marginTop: 28 },
	label: { fontSize: 14, fontWeight: "600", color: "#334155" },
	input: {
		marginTop: 8,
		borderWidth: 1,
		borderColor: "#cbd5e1",
		borderRadius: 12,
		paddingHorizontal: 14,
		paddingVertical: 12,
		fontSize: 16,
		color: "#0f172a",
		backgroundColor: "#fff",
	},
	cta: {
		marginTop: 20,
		backgroundColor: "#14532d",
		borderRadius: 12,
		paddingVertical: 14,
		alignItems: "center",
	},
	ctaLabel: { color: "#fff", fontSize: 15, fontWeight: "700" },
	row: { flexDirection: "row", alignItems: "center" },
	pressed: { opacity: 0.9 },
	hint: { marginTop: 14, fontSize: 13, color: "#64748b", lineHeight: 18 },
	backWrap: { marginTop: 28, alignSelf: "flex-start" },
	back: { fontSize: 14, color: "#14532d", fontWeight: "600", textDecorationLine: "underline" },
});
