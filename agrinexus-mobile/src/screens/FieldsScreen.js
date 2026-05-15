import React from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { fields } from '../data/fields';

export default function FieldsScreen() {
	return (
		<ScrollView style={styles.container}>
			<Text style={styles.title}>Моите полета</Text>

			{fields.map((field) => (
				<View key={field.id} style={styles.card}>
					<Text style={styles.name}>{field.name}</Text>
					<Text style={styles.info}>{field.crop}</Text>
					<Text style={styles.info}>{field.hectares} ха</Text>
					<Text style={styles.info}>Влажност: {field.moisture}% · {field.status}</Text>
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
		fontWeight: '800',
		marginBottom: 22,
		color: '#1a1916',
	},
	card: {
		backgroundColor: '#fff',
		borderRadius: 18,
		padding: 20,
		marginBottom: 14,
	},
	name: {
		fontSize: 20,
		fontWeight: '700',
		marginBottom: 8,
		color: '#1a1916',
	},
	info: {
		fontSize: 15,
		color: '#555',
		marginBottom: 5,
	},
});
