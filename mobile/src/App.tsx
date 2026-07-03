/**
 * SniperAI — Mobile App Entry Point
 * 
 * Electric Cyan futuristic design system v2.
 * 5-tab navigation: Discover, AI, [Center Snipe], History, Profile
 * Floating center action button with gradient glow.
 * Sci-fi premium fintech aesthetic.
 */

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { WalletProvider } from './providers/WalletProvider';
import HomeScreen from './screens/HomeScreen';
import TokenDetailScreen from './screens/TokenDetailScreen';
import PortfolioScreen from './screens/PortfolioScreen';
import AIChatScreen from './screens/AIChatScreen';
import SettingsScreen from './screens/SettingsScreen';
import { colors, navigationTheme, tabBarTheme, stackTheme, shadows } from './theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();


// Thin line icons for nav tabs
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Discover: '◎',     // Target/crosshair
    AI: '⚡',           // Spark/AI
    Snipe: '+',         // Center action (unused here, handled by custom button)
    History: '↻',       // History
    Profile: '○',       // Profile circle
  };
  return (
    <Text style={[
      styles.tabIcon,
      { color: focused ? colors.primary.cyan : 'rgba(255,255,255,0.3)' }
    ]}>
      {icons[name] || '○'}
    </Text>
  );
}

// Custom floating center button component
function CenterButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.centerBtnWrapper} onPress={onPress} activeOpacity={0.85}>
      <LinearGradient
        colors={['#0066FF', '#00E5FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.centerBtn}
      >
        <Text style={styles.centerBtnIcon}>+</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// Placeholder screen for center tab (triggers navigation to HomeScreen with snipe mode)
function SnipePlaceholder() {
  return <View style={{ flex: 1, backgroundColor: colors.dark.bg }} />;
}

function HomeTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...tabBarTheme,
        tabBarIcon: ({ focused }) => {
          if (route.name === 'Snipe') return null; // Custom button handles this
          return <TabIcon name={route.name} focused={focused} />;
        },
        tabBarButton: route.name === 'Snipe'
          ? (props: any) => <CenterButton onPress={() => (props as any).onPress?.()} />
          : undefined,
      })}
    >
      <Tab.Screen
        name="Discover"
        component={HomeScreen}
        options={{ title: 'Discover', headerTitle: 'SniperAI' }}
      />
      <Tab.Screen
        name="AI"
        component={AIChatScreen}
        options={{ title: 'AI' }}
      />
      <Tab.Screen
        name="Snipe"
        component={SnipePlaceholder}
        options={{
          title: 'Snipe',
          tabBarLabel: () => <Text style={styles.centerLabel}>Snipe</Text>,
        }}
      />
      <Tab.Screen
        name="History"
        component={PortfolioScreen}
        options={{ title: 'History' }}
      />
      <Tab.Screen
        name="Profile"
        component={SettingsScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
}


export default function App() {
  return (
    <WalletProvider>
      <NavigationContainer theme={navigationTheme as any}>
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
            options={{ title: 'Analysis' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </WalletProvider>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    fontSize: 22,
    marginTop: 4,
  },
  // Floating center button
  centerBtnWrapper: {
    top: -24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(10, 17, 32, 0.9)',
    ...shadows.blueGlow,
  },
  centerBtnIcon: {
    fontSize: 26,
    fontWeight: '300',
    color: '#FFFFFF',
    marginTop: -1,
  },
  centerLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.primary.cyan,
    marginTop: 4,
    letterSpacing: 0.3,
  },
});
