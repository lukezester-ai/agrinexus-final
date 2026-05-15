import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { fields } from '../data/fields';
import { colors, radii, spacing } from '../styles/theme';

export default function FieldsScreen() {
	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.content}>
			<Text style={styles.title}>Полета</Text>

			{fields.map((f) => (
				<View key={f.id} style={styles.card}>
					<Text style={styles.field}>{f.name}</Text>
					<Text style={styles.meta}>
						{f.crop} · {f.hectares} ха
					</Text>
					<Text style={styles.moisture}>Влажност: {f.moisture}%</Text>
				</View>
			))}
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
		paddingBottom: 32,
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
	field: {
		fontSize: 18,
		fontWeight: '700',
		marginBottom: 8,
		color: colors.text,
	},
	meta: {
		fontSize: 14,
		color: colors.muted,
		marginBottom: 8,
	},
	moisture: {
		fontSize: 16,
		color: colors.accent,
		fontWeight: '600',
	},
});
