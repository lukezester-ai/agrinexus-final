import { Stack } from "expo-router";
import { AuthProvider } from "../context/AuthContext";
import { LanguageProvider } from "../context/LanguageContext";
import { LangToggle } from "../components/LangToggle";

export default function RootLayout() {
	return (
		<LanguageProvider>
			<AuthProvider>
				<Stack
					screenOptions={{
						headerStyle: { backgroundColor: "#F8F6F1" },
						headerShadowVisible: false,
						headerTintColor: "#1F4D2C",
						headerTitleStyle: { fontWeight: "600", fontSize: 17 },
						contentStyle: { backgroundColor: "#F8F6F1" },
						headerRight: () => <LangToggle />,
					}}
				/>
			</AuthProvider>
		</LanguageProvider>
	);
}
