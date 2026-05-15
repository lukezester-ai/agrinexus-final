import React, { useState } from 'react';
import {
	View,
	Text,
	TextInput,
	StyleSheet,
	Pressable,
	KeyboardAvoidingView,
	Platform,
} from 'react-native';
import { colors, radii, spacing } from '../styles/theme';

/** За бъдещ Supabase login — пока не е в navigation. */
export default function LoginScreen() {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');

	return (
		<KeyboardAvoidingView
			style={styles.container}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
			<Text style={styles.title}>Вход</Text>
			<Text style={styles.subtitle}>Същият акаунт като AgriNexus уеб</Text>

			<TextInput
				style={styles.input}
				placeholder="Имейл"
				placeholderTextColor={colors.muted}
				autoCapitalize="none"
				keyboardType="email-address"
				value={email}
				onChangeText={setEmail}
			/>
			<TextInput
				style={styles.input}
				placeholder="Парола"
				placeholderTextColor={colors.muted}
				secureTextEntry
				value={password}
				onChangeText={setPassword}
			/>

			<Pressable style={styles.btn}>
				<Text style={styles.btnText}>Вход (скоро)</Text>
			</Pressable>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.bg,
		padding: spacing.screen,
		justifyContent: 'center',
	},
	title: {
		fontSize: 32,
		fontWeight: '700',
		color: colors.text,
		marginBottom: 8,
	},
	subtitle: {
		fontSize: 15,
		color: colors.muted,
		marginBottom: 24,
	},
	input: {
		backgroundColor: colors.surface,
		borderRadius: radii.cardSm,
		padding: 16,
		marginBottom: 12,
		fontSize: 16,
		color: colors.text,
	},
	btn: {
		backgroundColor: colors.accent,
		borderRadius: radii.cardSm,
		padding: 16,
		alignItems: 'center',
		marginTop: 8,
	},
	btnText: {
		color: '#fff',
		fontSize: 17,
		fontWeight: '700',
	},
});
