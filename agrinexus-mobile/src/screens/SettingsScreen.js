import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { isSupabaseConfigured } from '../services/supabase';
import { colors, radii, spacing } from '../styles/theme';

export default function SettingsScreen() {
	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.content}>
			<Text style={styles.title}>Настройки</Text>

			<View style={styles.card}>
				<Text style={styles.label}>План</Text>
				<Text style={styles.value}>Starter €149</Text>
			</View>

			<View style={styles.card}>
				<Text style={styles.label}>Облак (Supabase)</Text>
				<Text style={styles.value}>{isSupabaseConfigured ? 'Свързан' : 'Демо (без .env)'}</Text>
			</View>

			<View style={styles.card}>
				<Text style={styles.label}>Уеб приложение</Text>
				<Text style={styles.hint}>agrinexus.eu.com — същият акаунт след login upgrade</Text>
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.bg,
	},
	content: {
		padding: spacing.screen,
	},
	title: {
		fontSize: 30,
		fontWeight: '700',
		marginBottom: 20,
		color: colors.text,
	},
	card: {
		backgroundColor: colors.surface,
		borderRadius: radii.cardSm,
		padding: 20,
		marginBottom: 14,
	},
	label: {
		fontSize: 14,
		color: colors.muted,
		marginBottom: 8,
	},
	value: {
		fontSize: 22,
		fontWeight: '700',
		color: colors.accent,
	},
	hint: {
		fontSize: 14,
		color: colors.muted,
		lineHeight: 20,
	},
});
