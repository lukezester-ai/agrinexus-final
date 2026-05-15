import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii } from '../styles/theme';

export default function WeatherCard({ location, tempC, condition, soilMoisture, windKmh, rainNext48h }) {
	return (
		<View style={styles.card}>
			<Text style={styles.label}>Метео · {location}</Text>
			<Text style={styles.temp}>{tempC}°C</Text>
			<Text style={styles.condition}>{condition}</Text>
			<Text style={styles.meta}>Влажност почва: {soilMoisture}%</Text>
			<Text style={styles.meta}>Вятър: {windKmh} km/h · Дъжд 48ч: {rainNext48h}</Text>
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
		marginBottom: 8,
	},
	temp: {
		fontSize: 36,
		fontWeight: '700',
		color: colors.text,
		marginBottom: 4,
	},
	condition: {
		fontSize: 16,
		color: colors.text,
		marginBottom: 12,
	},
	meta: {
		fontSize: 14,
		color: colors.muted,
		marginTop: 4,
	},
});
