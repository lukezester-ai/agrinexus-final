import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii } from '../styles/theme';

export default function StatCard({ label, value }) {
	return (
		<View style={styles.card}>
			<Text style={styles.label}>{label}</Text>
			<Text style={styles.value}>{value}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	card: {
		backgroundColor: colors.surface,
		borderRadius: radii.card,
		padding: 20,
		marginBottom: 16,
	},
	label: {
		fontSize: 14,
		color: colors.muted,
		marginBottom: 10,
	},
	value: {
		fontSize: 42,
		fontWeight: '700',
		color: colors.accent,
	},
});
