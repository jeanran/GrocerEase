import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Import all screens
import LoginScreen from './screens/LoginScreen';
import POSScreen from './screens/POSScreen';
import AdminDashboard from './screens/AdminDashboard';

const Stack = createNativeStackNavigator();

export default function App() {
    return (
        <NavigationContainer>
            <Stack.Navigator
                initialRouteName="Login"
                screenOptions={{ headerShown: false }}
            >
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="POSScreen" component={POSScreen} />
                <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}