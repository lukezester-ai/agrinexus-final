import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function SettingsScreen() {
	return (
		<View style={styles.container}>
			<Text style={styles.title}>Настройки</Text>

			<View style={styles.card}>
				<Text style={styles.label}>План</Text>
				<Text style={styles.value}>Starter Plan</Text>
			</View>
		</View>
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
		fontWeight: '800',
		marginBottom: 20,
		color: '#1a1916',
	},
	card: {
		backgroundColor: '#fff',
		borderRadius: 18,
		padding: 20,
	},
	label: {
		fontSize: 14,
		color: '#666',
		marginBottom: 10,
	},
	value: {
		fontSize: 22,
		fontWeight: '700',
		color: '#1a7a52',
	},
});
