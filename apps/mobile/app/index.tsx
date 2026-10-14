import { Link, Stack } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { strings } from "../lib/strings";

export default function HomeScreen() {
	const { locale } = useLanguage();
	const s = strings(locale);
	const { email, ready, signOut } = useAuth();
	const sessionLine = email ? s.home.signedInAs.replace("{{email}}", email) : null;

	return (
		<View style={styles.screen}>
			<Stack.Screen options={{ title: s.home.title, headerLargeTitle: false }} />
			<Text style={styles.kicker}>AgriNexus</Text>
			<Text style={styles.title}>{s.home.title}</Text>
			<Text style={styles.sub}>{s.home.subtitle}</Text>
			{ready && sessionLine ? <Text style={styles.session}>{sessionLine}</Text> : null}

			<View style={styles.actions}>
				<Link href="/login" asChild>
					<Pressable style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
						<Text style={styles.primaryLabel}>{s.home.login}</Text>
					</Pressable>
				</Link>
				<Link href="/academy" asChild>
					<Pressable style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}>
						<Text style={styles.secondaryLabel}>{s.home.academy}</Text>
					</Pressable>
				</Link>
				{ready && email ? (
					<Pressable
						style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
						onPress={() => void signOut()}
					>
						<Text style={styles.ghostLabel}>{s.home.signOut}</Text>
					</Pressable>
				) : null}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: "#F8F6F1",
		paddingHorizontal: 24,
		paddingTop: 16,
		justifyContent: "center",
	},
	kicker: {
		fontSize: 12,
		fontWeight: "700",
		letterSpacing: 1.2,
		color: "#1F4D2C",
		textTransform: "uppercase",
	},
	title: {
		marginTop: 8,
		fontSize: 32,
		fontWeight: "700",
		color: "#0A0A0A",
	},
	sub: {
		marginTop: 10,
		fontSize: 16,
		lineHeight: 24,
		color: "#5F5E5A",
	},
	session: {
		marginTop: 12,
		fontSize: 14,
		fontWeight: "600",
		color: "#1F4D2C",
	},
	actions: {
		marginTop: 32,
		gap: 12,
	},
	primaryBtn: {
		backgroundColor: "#1F4D2C",
		paddingVertical: 14,
		borderRadius: 14,
		alignItems: "center",
	},
	secondaryBtn: {
		backgroundColor: "rgba(255,255,255,0.85)",
		borderWidth: 1,
		borderColor: "rgba(10,10,10,0.1)",
		paddingVertical: 14,
		borderRadius: 14,
		alignItems: "center",
	},
	pressed: {
		opacity: 0.88,
		transform: [{ scale: 0.99 }],
	},
	primaryLabel: {
		color: "#fff",
		fontSize: 16,
		fontWeight: "600",
	},
	secondaryLabel: {
		color: "#0A0A0A",
		fontSize: 16,
		fontWeight: "600",
	},
	ghostBtn: {
		paddingVertical: 12,
		borderRadius: 14,
		alignItems: "center",
		borderWidth: 1,
		borderColor: "rgba(10,10,10,0.15)",
	},
	ghostLabel: {
		color: "#5F5E5A",
		fontSize: 15,
		fontWeight: "600",
	},
});
