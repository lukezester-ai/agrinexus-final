import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLanguage } from "../context/LanguageContext";

export function LangToggle() {
	const { locale, setLocale } = useLanguage();
	return (
		<View style={styles.wrap}>
			<Pressable
				onPress={() => setLocale("en")}
				style={[styles.btn, locale === "en" && styles.btnActive]}
				accessibilityRole="button"
				accessibilityState={{ selected: locale === "en" }}
			>
				<Text style={[styles.label, locale === "en" && styles.labelActive]}>EN</Text>
			</Pressable>
			<Pressable
				onPress={() => setLocale("bg")}
				style={[styles.btn, locale === "bg" && styles.btnActive]}
				accessibilityRole="button"
				accessibilityState={{ selected: locale === "bg" }}
			>
				<Text style={[styles.label, locale === "bg" && styles.labelActive]}>БГ</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		flexDirection: "row",
		borderRadius: 999,
		borderWidth: 1,
		borderColor: "rgba(10,10,10,0.12)",
		backgroundColor: "rgba(255,255,255,0.75)",
		padding: 2,
	},
	btn: {
		paddingHorizontal: 10,
		paddingVertical: 5,
		borderRadius: 999,
	},
	btnActive: {
		backgroundColor: "#0A0A0A",
	},
	label: {
		fontSize: 11,
		fontWeight: "600",
		color: "rgba(10,10,10,0.55)",
	},
	labelActive: {
		color: "#fff",
	},
});
