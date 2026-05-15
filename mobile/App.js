import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Import all screens
import LoginScreen from './screens/LoginScreen';
import POSScreen from './screens/POSScreen';
import AdminDashboard from './screens/AdminDashboard';
import StockInScreen from './screens/StockInScreen';
import StockInHistoryScreen from './screens/StockInHistoryScreen';
import StockOutScreen from './screens/StockOutScreen';
import InventoryScreen from './screens/InventoryScreen';
import UsersManagementScreen from './screens/UsersManagementScreen';

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
                <Stack.Screen name="StockIn" component={StockInScreen} />
                <Stack.Screen name="StockInHistory" component={StockInHistoryScreen} />
                <Stack.Screen name="StockOut" component={StockOutScreen} />
                <Stack.Screen name="Inventory" component={InventoryScreen} />
                <Stack.Screen name="Users" component={UsersManagementScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
