import React from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { fields } from '../data/fields';

const totalHa = fields.reduce((sum, f) => sum + f.hectares, 0);
const critical = fields.find((f) => f.status === 'критично');

export default function DashboardScreen() {
	return (
		<ScrollView style={styles.container}>
			<Text style={styles.title}>Табло</Text>

			<View style={styles.summaryCard}>
				<Text style={styles.summaryLabel}>Общо площ</Text>
				<Text style={styles.summaryValue}>{totalHa} ха</Text>
				<Text style={styles.summaryMeta}>{fields.length} активни полета</Text>
			</View>

			{critical ? (
				<View style={styles.alertCard}>
					<Text style={styles.alertTitle}>Критична влажност</Text>
					<Text style={styles.alertText}>
						{critical.name} — {critical.moisture}% влажност ({critical.status}). Препоръка:
						проверка на напояване в следващите 24 часа.
					</Text>
				</View>
			) : null}

			<Text style={styles.section}>Полета</Text>

			{fields.map((field) => (
				<View key={field.id} style={styles.fieldCard}>
					<Text style={styles.fieldName}>{field.name}</Text>
					<Text style={styles.fieldCrop}>
						{field.crop} · {field.hectares} ха
					</Text>
					<Text style={styles.fieldInfo}>Статус: {field.status}</Text>
					<Text
						style={[
							styles.moisture,
							field.status === 'критично' && styles.moistureCritical,
						]}>
						Влажност: {field.moisture}%
					</Text>
				</View>
			))}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#f5f4f0',
		padding: 18,
	},
	title: {
		fontSize: 32,
		fontWeight: '700',
		marginBottom: 20,
		color: '#1a1916',
	},
	summaryCard: {
		backgroundColor: '#fff',
		borderRadius: 18,
		padding: 20,
		marginBottom: 20,
	},
	summaryLabel: {
		fontSize: 14,
		color: '#666',
		marginBottom: 8,
	},
	summaryValue: {
		fontSize: 42,
		fontWeight: '700',
		color: '#1a7a52',
	},
	summaryMeta: {
		marginTop: 8,
		fontSize: 15,
		color: '#444',
	},
	alertCard: {
		backgroundColor: '#fff1f2',
		padding: 18,
		borderRadius: 18,
		marginBottom: 20,
	},
	alertTitle: {
		fontSize: 16,
		fontWeight: '700',
		color: '#be123c',
		marginBottom: 10,
	},
	alertText: {
		fontSize: 15,
		lineHeight: 22,
		color: '#1a1916',
	},
	section: {
		fontSize: 24,
		fontWeight: '700',
		marginBottom: 14,
		color: '#1a1916',
	},
	fieldCard: {
		backgroundColor: '#fff',
		borderRadius: 20,
		padding: 18,
		marginBottom: 14,
	},
	fieldName: {
		fontSize: 20,
		fontWeight: '700',
	},
	fieldCrop: {
		marginTop: 10,
		color: '#666',
		fontSize: 15,
	},
	fieldInfo: {
		marginTop: 5,
		color: '#444',
		fontSize: 15,
	},
	moisture: {
		marginTop: 12,
		fontSize: 16,
		fontWeight: '700',
		color: '#1a7a52',
	},
	moistureCritical: {
		color: '#be123c',
	},
});
