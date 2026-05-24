/**
 * SniperAI — Mobile App Entry Point
 * 
 * Redesigned with grey/purple theme inspired by Kiro UI + Phantom Wallet.
 * Clean navigation with smooth transitions.
 */

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet } from 'react-native';

import { WalletProvider } from './providers/WalletProvider';
import HomeScreen from './screens/HomeScreen';
import TokenDetailScreen from './screens/TokenDetailScreen';
import PortfolioScreen from './screens/PortfolioScreen';
import AIChatScreen from './screens/AIChatScreen';
import SettingsScreen from './screens/SettingsScreen';
import { colors, navigationTheme, tabBarTheme, stackTheme } from './theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Custom tab bar icons — clean minimalist style
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Feed: '◎',
    Portfolio: '◈',
    AI: '◉',
    Settings: '◇',
  };
  return (
    <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
      <Text style={[styles.tabIconText, focused && styles.tabIconTextActive]}>
        {icons[name] || '○'}
      </Text>
    </View>
  );
}

function HomeTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...tabBarTheme,
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen
        name="Feed"
        component={HomeScreen}
        options={{ title: 'Discover', headerTitle: 'SniperAI' }}
      />
      <Tab.Screen
        name="Portfolio"
        component={PortfolioScreen}
        options={{ title: 'Portfolio' }}
      />
      <Tab.Screen
        name="AI"
        component={AIChatScreen}
        options={{ title: 'AI' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <WalletProvider>
      <NavigationContainer theme={navigationTheme}>
        <StatusBar style="light" />
        <Stack.Navigator screenOptions={stackTheme}>
          <Stack.Screen
            name="Main"
            component={HomeTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="TokenDetail"
            component={TokenDetailScreen}
            options={{ title: 'Token' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </WalletProvider>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
  },
  tabIconText: {
    fontSize: 18,
    color: colors.text.tertiary,
  },
  tabIconTextActive: {
    color: colors.purple[400],
  },
});
