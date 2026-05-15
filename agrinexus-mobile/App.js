import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';

import DashboardScreen from './src/screens/DashboardScreen';
import FieldsScreen from './src/screens/FieldsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { colors } from './src/styles/theme';

const Tab = createBottomTabNavigator();

export default function App() {
	return (
		<>
			<NavigationContainer>
				<Tab.Navigator
					screenOptions={{
						headerStyle: {
							backgroundColor: colors.header,
						},
						headerTintColor: '#fff',
						tabBarStyle: {
							backgroundColor: '#fff',
							height: 65,
							paddingBottom: 8,
							paddingTop: 6,
						},
						tabBarActiveTintColor: colors.accent,
					}}>
					<Tab.Screen
						name="Dashboard"
						component={DashboardScreen}
						options={{ title: 'Табло' }}
					/>
					<Tab.Screen name="Полета" component={FieldsScreen} />
					<Tab.Screen name="Настройки" component={SettingsScreen} />
				</Tab.Navigator>
			</NavigationContainer>
			<StatusBar style="light" />
		</>
	);
}
