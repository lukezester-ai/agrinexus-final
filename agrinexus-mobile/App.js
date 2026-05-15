import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import DashboardScreen from './src/screens/DashboardScreen';
import FieldsScreen from './src/screens/FieldsScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();

export default function App() {
	return (
		<NavigationContainer>
			<Tab.Navigator
				screenOptions={{
					headerStyle: {
						backgroundColor: '#1a1916',
					},
					headerTintColor: '#fff',
					tabBarActiveTintColor: '#1a7a52',
					tabBarStyle: {
						height: 65,
						paddingBottom: 8,
					},
				}}>
				<Tab.Screen name="Dashboard" component={DashboardScreen} />
				<Tab.Screen name="Полета" component={FieldsScreen} />
				<Tab.Screen name="Настройки" component={SettingsScreen} />
			</Tab.Navigator>
		</NavigationContainer>
	);
}
