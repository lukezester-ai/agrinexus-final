import React from 'react';
import { Text, StyleSheet, ScrollView } from 'react-native';
import StatCard from '../components/StatCard';
import AlertCard from '../components/AlertCard';
import WeatherCard from '../components/WeatherCard';
import { alerts } from '../data/alerts';
import { fields } from '../data/fields';
import { weather } from '../data/weather';
import { colors, spacing } from '../styles/theme';

const totalHa = fields.reduce((sum, f) => sum + f.hectares, 0);

export default function DashboardScreen() {
	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.content}>
			<Text style={styles.title}>Табло</Text>

			<StatCard label="Общо площ" value={`${totalHa} ха`} />
			<StatCard label="Активни полета" value={String(fields.length)} />

			<WeatherCard {...weather} />

			{alerts.map((a) => (
				<AlertCard key={a.id} message={a.message} />
			))}

			<Text style={styles.section}>Полета</Text>
			{fields.map((f) => (
				<StatCard
					key={f.id}
					label={`${f.name} · ${f.crop}`}
					value={`${f.moisture}%`}
				/>
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
		fontSize: 32,
		fontWeight: '700',
		marginBottom: 20,
		color: colors.text,
	},
	section: {
		fontSize: 22,
		fontWeight: '700',
		marginBottom: 12,
		marginTop: 10,
		color: colors.text,
	},
});
