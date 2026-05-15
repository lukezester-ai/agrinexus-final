import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii } from '../styles/theme';

export default function AlertCard({ message }) {
	return (
		<View style={styles.card}>
			<Text style={styles.alert}>{message}</Text>
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
	alert: {
		fontSize: 16,
		color: colors.alert,
		fontWeight: '600',
	},
});
