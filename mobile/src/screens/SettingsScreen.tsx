/**
 * SettingsScreen — Account, wallet, alerts, risk management
 * 
 * Electric Cyan style: Dark glassmorphism cards, neon cyan toggles,
 * futuristic section headers, premium cyber interface.
 * Deep space aesthetic with high contrast.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useWallet } from '../hooks/useWallet';
import TradeButton from '../components/TradeButton';
import { colors, spacing, radius, typography, shadows, glass } from '../theme';
import { getSKRBalance, claimDailyReward, checkGenesisToken } from '../services/skr';

export default function SettingsScreen() {
  const { wallet, isConnected, isConnecting, connect, disconnect } = useWallet();
  const [skrBalance, setSkrBalance] = useState(0);
  const [hasGenesis, setHasGenesis] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [autoTrade, setAutoTrade] = useState(false);

  useEffect(() => {
    if (wallet) {
      getSKRBalance(wallet).then(res => setSkrBalance(res.balance || 0));
      checkGenesisToken(wallet).then(res => setHasGenesis(res));
    }
  }, [wallet]);

  const handleClaimDaily = async () => {
    const res = await claimDailyReward();
    if (res.success) {
      Alert.alert('Reward Claimed!', `+${res.amount} SKR\nStreak: ${res.streak} days`);
      if (wallet) getSKRBalance(wallet).then(r => setSkrBalance(r.balance || 0));
    } else {
      Alert.alert('Already Claimed', 'Come back tomorrow for your next reward!');
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Wallet Section */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleDot} />
          <Text style={styles.cardTitle}>Wallet</Text>
        </View>
        {isConnected ? (
          <>
            <View style={styles.walletInfo}>
              <View style={styles.walletAvatar}>
                <Text style={styles.walletAvatarText}>◈</Text>
              </View>
              <View style={styles.walletDetails}>
                <Text style={styles.walletAddress}>
                  {wallet?.slice(0, 6)}...{wallet?.slice(-4)}
                </Text>
                <Text style={styles.walletStatus}>● Connected via Seed Vault</Text>
              </View>
            </View>
            {hasGenesis && (
              <View style={styles.genesisBadge}>
                <Text style={styles.genesisText}>✦ Seeker Genesis Holder · 50% Off</Text>
              </View>
            )}
            <TradeButton
              label="Disconnect"
              variant="ghost"
              size="sm"
              onPress={disconnect}
            />
          </>
        ) : (
          <TradeButton
            label={isConnecting ? 'Connecting...' : '◈ Connect Wallet'}
            variant="primary"
            onPress={connect}
            loading={isConnecting}
          />
        )}
      </View>

      {/* SKR Rewards */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleDot} />
          <Text style={styles.cardTitle}>SKR Rewards</Text>
        </View>
        <View style={styles.skrRow}>
          <View>
            <Text style={styles.skrBalance}>{skrBalance.toFixed(1)}</Text>
            <Text style={styles.skrLabel}>SKR Balance</Text>
          </View>
          <TradeButton
            label="⚡ Claim Daily"
            variant="outline"
            size="sm"
            onPress={handleClaimDaily}
            fullWidth={false}
          />
        </View>
      </View>

      {/* Notifications */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleDot} />
          <Text style={styles.cardTitle}>Notifications</Text>
        </View>
        <SettingToggle
          label="Push Alerts"
          description="Get notified on high-score tokens"
          value={alertsEnabled}
          onToggle={setAlertsEnabled}
        />
        <SettingRow label="Min Score for Alert" value="75" />
        <SettingRow label="Alert on Rug Detected" value="On" />
        <SettingRow label="Alert on Take Profit" value="On" />
        <SettingRow label="Alert on Stop Loss" value="On" />
      </View>

      {/* Risk Management */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleDot} />
          <Text style={styles.cardTitle}>Risk Management</Text>
        </View>
        <SettingToggle
          label="Auto-Trade"
          description="Automatically execute on high scores"
          value={autoTrade}
          onToggle={setAutoTrade}
        />
        <SettingRow label="Buy Amount" value="0.5 SOL" />
        <SettingRow label="Max Positions" value="3" />
        <SettingRow label="Stop Loss" value="-40%" />
        <SettingRow label="Trailing Stop" value="25%" />
        <SettingRow label="Take Profit (2x)" value="50%" />
        <SettingRow label="Daily Loss Limit" value="5 SOL" />
      </View>

      {/* App Info */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleDot} />
          <Text style={styles.cardTitle}>About</Text>
        </View>
        <SettingRow label="Version" value="1.1.0" />
        <SettingRow label="Platform" value="Solana Mobile (Seeker)" />
        <SettingRow label="Network" value="Mainnet Beta" />
      </View>

      <View style={{ height: spacing.section }} />
    </ScrollView>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Text style={styles.settingValue}>{value}</Text>
    </View>
  );
}

function SettingToggle({ label, description, value, onToggle }: {
  label: string; description?: string; value: boolean; onToggle: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleLeft}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description && <Text style={styles.toggleDesc}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.bg.tertiary, true: 'rgba(0, 229, 255, 0.4)' }}
        thumbColor={value ? colors.cyan[400] : colors.text.tertiary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    padding: spacing.lg,
  },
  card: {
    ...glass.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  cardTitleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.cyan[400],
    marginRight: spacing.sm,
  },
  cardTitle: {
    ...typography.label,
    color: colors.cyan[400],
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  walletInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  walletAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderWidth: 1,
    borderColor: colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  walletAvatarText: {
    fontSize: 20,
    color: colors.cyan[400],
  },
  walletDetails: {},
  walletAddress: {
    ...typography.label,
    color: colors.text.primary,
    fontFamily: 'monospace',
  },
  walletStatus: {
    ...typography.caption,
    color: colors.success,
    marginTop: 3,
  },
  genesisBadge: {
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  genesisText: {
    ...typography.labelSm,
    color: colors.cyan[400],
  },
  skrRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skrBalance: {
    ...typography.numberLg,
    color: colors.text.primary,
  },
  skrLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  settingLabel: {
    ...typography.body,
    color: colors.text.secondary,
  },
  settingValue: {
    ...typography.label,
    color: colors.text.primary,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  toggleLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  toggleLabel: {
    ...typography.body,
    color: colors.text.primary,
  },
  toggleDesc: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
});
