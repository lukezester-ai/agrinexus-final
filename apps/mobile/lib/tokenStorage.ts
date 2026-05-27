import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEY_TOKEN = "agrinexus_access_token";
const KEY_EMAIL = "agrinexus_user_email";

export async function saveSession(token: string, email: string) {
	if (Platform.OS === "web") {
		try {
			await AsyncStorage.multiSet([
				[KEY_TOKEN, token],
				[KEY_EMAIL, email],
			]);
		} catch {
			// ignore
		}
		return;
	}
	await SecureStore.setItemAsync(KEY_TOKEN, token);
	await SecureStore.setItemAsync(KEY_EMAIL, email);
}

export async function loadSession(): Promise<{ token: string; email: string } | null> {
	try {
		if (Platform.OS === "web") {
			const [[, token], [, email]] = await AsyncStorage.multiGet([KEY_TOKEN, KEY_EMAIL]);
			if (!token) return null;
			return { token, email: email ?? "" };
		}
		const token = await SecureStore.getItemAsync(KEY_TOKEN);
		const email = await SecureStore.getItemAsync(KEY_EMAIL);
		if (!token) return null;
		return { token, email: email ?? "" };
	} catch {
		return null;
	}
}

export async function clearSession() {
	try {
		if (Platform.OS === "web") {
			await AsyncStorage.multiRemove([KEY_TOKEN, KEY_EMAIL]);
			return;
		}
		await SecureStore.deleteItemAsync(KEY_TOKEN);
		await SecureStore.deleteItemAsync(KEY_EMAIL);
	} catch {
		// ignore
	}
}
