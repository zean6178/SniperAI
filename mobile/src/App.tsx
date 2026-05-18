/**
 * SniperAI — Mobile App Entry Point
 * 
 * Wrapped with WalletProvider for Seed Vault / MWA integration.
 */

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { WalletProvider } from './providers/WalletProvider';
import HomeScreen from './screens/HomeScreen';
import TokenDetailScreen from './screens/TokenDetailScreen';
import PortfolioScreen from './screens/PortfolioScreen';
import AIChatScreen from './screens/AIChatScreen';
import SettingsScreen from './screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function HomeTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: { backgroundColor: '#0D0D0D', borderTopColor: '#1a1a2e' },
        tabBarActiveTintColor: '#00d4aa',
        tabBarInactiveTintColor: '#666',
        headerStyle: { backgroundColor: '#0D0D0D' },
        headerTintColor: '#fff',
      }}
    >
      <Tab.Screen
        name="Feed"
        component={HomeScreen}
        options={{ title: '🎯 Feed', headerTitle: 'SniperAI' }}
      />
      <Tab.Screen
        name="Portfolio"
        component={PortfolioScreen}
        options={{ title: '📊 Portfolio' }}
      />
      <Tab.Screen
        name="AI"
        component={AIChatScreen}
        options={{ title: '🤖 AI Chat' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: '⚙️ Settings' }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <WalletProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: '#0D0D0D' },
            headerTintColor: '#fff',
          }}
        >
          <Stack.Screen
            name="Main"
            component={HomeTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="TokenDetail"
            component={TokenDetailScreen}
            options={{ title: 'Token Detail' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </WalletProvider>
  );
}
