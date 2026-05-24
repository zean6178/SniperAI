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
import { ThemeProvider, useTheme } from './providers/ThemeProvider';
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
  const { colors: c } = useTheme();
  const icons: Record<string, string> = {
    Feed: '◎',
    Portfolio: '◈',
    AI: '◉',
    Settings: '◇',
  };
  return (
    <View style={[styles.tabIcon, focused && { backgroundColor: `${c.purple[400]}20` }]}>
      <Text style={[styles.tabIconText, { color: focused ? c.purple[400] : c.text.tertiary }]}>
        {icons[name] || '○'}
      </Text>
    </View>
  );
}

function HomeTabs() {
  const { tabBarTheme: tbTheme } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...tbTheme,
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

function AppContent() {
  const { navigationTheme: navTheme, stackTheme: sTheme } = useTheme();
  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="auto" />
      <Stack.Navigator screenOptions={sTheme}>
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
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <WalletProvider>
        <AppContent />
      </WalletProvider>
    </ThemeProvider>
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
  tabIconText: {
    fontSize: 18,
  },
});
