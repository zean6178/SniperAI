/**
 * SettingsScreen — Wallet, alerts, risk config
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useWallet } from '../hooks/useWallet';

export default function SettingsScreen() {
  const { wallet, isConnected, connect, disconnect } = useWallet();

  return (
    <View style={styles.container}>
      {/* Wallet Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Wallet</Text>
        {isConnected ? (
          <>
            <Text style={styles.walletAddr}>{wallet?.slice(0, 8)}…{wallet?.slice(-6)}</Text>
            <TouchableOpacity style={styles.btnDanger} onPress={disconnect}>
              <Text style={styles.btnText}>Disconnect</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.btnPrimary} onPress={connect}>
            <Text style={styles.btnText}>Connect Wallet (Seed Vault)</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Alert Config */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notifications</Text>
        <SettingRow label="Min Score for Alert" value="75" />
        <SettingRow label="Alert on Rug" value="ON" />
        <SettingRow label="Alert on Take Profit" value="ON" />
        <SettingRow label="Alert on Stop Loss" value="ON" />
        <SettingRow label="Max Alerts / Hour" value="10" />
      </View>

      {/* Risk Config */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Risk Management</Text>
        <SettingRow label="Buy Amount" value="0.5 SOL" />
        <SettingRow label="Max Positions" value="3" />
        <SettingRow label="Stop Loss" value="-40%" />
        <SettingRow label="Trailing Stop" value="25%" />
        <SettingRow label="Daily Loss Limit" value="5 SOL" />
      </View>

      {/* App Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>About</Text>
        <Text style={styles.infoText}>SniperAI v1.0.0</Text>
        <Text style={styles.infoText}>Built for Solana Mobile (Seeker)</Text>
      </View>
    </View>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D', padding: 12 },
  card: {
    backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, marginBottom: 12,
  },
  cardTitle: { color: '#00d4aa', fontSize: 14, fontWeight: '700', marginBottom: 12 },
  walletAddr: { color: '#fff', fontSize: 14, fontFamily: 'monospace', marginBottom: 12 },
  btnPrimary: {
    backgroundColor: '#00d4aa', borderRadius: 8, padding: 12, alignItems: 'center',
  },
  btnDanger: {
    backgroundColor: '#ff4444', borderRadius: 8, padding: 12, alignItems: 'center',
  },
  btnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  settingRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#252540',
  },
  settingLabel: { color: '#888', fontSize: 13 },
  settingValue: { color: '#fff', fontSize: 13, fontWeight: '600' },
  infoText: { color: '#666', fontSize: 12, marginBottom: 4 },
});
