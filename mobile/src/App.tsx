/**
 * SniperAI — Mobile App Entry Point
 * 
 * Electric Cyan futuristic design system.
 * Sci-fi OS feel with neon cyan navigation accents.
 * Bottom nav with outline icons and cyan glow indicators.
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

// Futuristic tab bar icons — thin outline style with cyan neon accents
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Feed: '◎',       // Target icon
    Portfolio: '◈',   // Wallet/diamond icon
    AI: '⚡',         // Spark/AI icon
    Settings: '◇',   // Settings/profile icon
  };
  return (
    <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
      <Text style={[styles.tabIconText, focused && styles.tabIconTextActive]}>
        {icons[name] || '○'}
      </Text>
      {focused && <View style={styles.tabIndicator} />}
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
        options={{ title: 'Discover', headerTitle: '⚡ SniperAI' }}
      />
      <Tab.Screen
        name="Portfolio"
        component={PortfolioScreen}
        options={{ title: 'Portfolio' }}
      />
      <Tab.Screen
        name="AI"
        component={AIChatScreen}
        options={{ title: 'AI Chat' }}
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
            options={{ title: 'Token Analysis' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </WalletProvider>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
  },
  tabIconText: {
    fontSize: 18,
    color: colors.text.tertiary,
  },
  tabIconTextActive: {
    color: colors.cyan[400],
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.cyan[400],
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
});
