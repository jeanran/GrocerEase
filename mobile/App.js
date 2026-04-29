import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Only keep these two screen imports
import LoginScreen from './screens/LoginScreen';
import POSScreen from './screens/POSScreen';

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
            </Stack.Navigator>
        </NavigationContainer>
    );
}
