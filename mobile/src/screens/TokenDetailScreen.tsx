/**
 * TokenDetailScreen — Detailed view + buy/sell buttons
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import ScoreBadge from '../components/ScoreBadge';
import TradeButton from '../components/TradeButton';
import { useWallet } from '../hooks/useWallet';
import { api } from '../services/api';

export default function TokenDetailScreen({ route }: any) {
  const { token } = route.params;
  const { isConnected: walletConnected } = useWallet();
  const [buying, setBuying] = useState(false);

  const handleBuy = async () => {
    if (!walletConnected) {
      Alert.alert('Wallet Required', 'Connect your wallet in Settings first.');
      return;
    }
    setBuying(true);
    try {
      // In real app: prepare tx → sign with Seed Vault → submit
      Alert.alert('Buy Prepared', `Ready to buy ${token.symbol} with 0.5 SOL\n\nSign with Seed Vault to confirm.`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBuying(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.symbol}>{token.symbol || '???'}</Text>
          <Text style={styles.name}>{token.name || 'Unknown'}</Text>
        </View>
        <ScoreBadge score={token.score} decision={token.decision} />
      </View>

      {/* Market Data */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Market Data</Text>
        <DataRow label="Market Cap" value={`${(token.marketCapSol || 0).toFixed(2)} SOL`} />
        <DataRow label="Bonding Curve" value={token.bondingCurvePct ? `${token.bondingCurvePct.toFixed(1)}%` : 'N/A'} />
        <DataRow label="Volume (5m)" value={`${(token.volume5mSol || 0).toFixed(2)} SOL`} />
        <DataRow label="Buy Count (5m)" value={`${token.buyCount5m || 0}`} />
        <DataRow label="Unique Buyers" value={`${token.uniqueBuyers || 0}`} />
        <DataRow label="Bundled" value={token.isBundled ? '🚫 YES' : '✅ No'} />
      </View>

      {/* Deployer Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Deployer</Text>
        <Text style={styles.monoText}>{token.deployer?.slice(0, 20)}…</Text>
      </View>

      {/* Screening Reasons */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Screening Reasons</Text>
        {(token.reasons || []).map((reason: string, i: number) => (
          <Text key={i} style={styles.reasonText}>{reason}</Text>
        ))}
      </View>

      {/* Mint Address */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Mint</Text>
        <Text style={styles.monoText}>{token.mint}</Text>
      </View>

      {/* Trade Buttons */}
      <View style={styles.tradeRow}>
        <TradeButton
          label={buying ? 'Preparing...' : '🟢 Buy 0.5 SOL'}
          color="#00d4aa"
          onPress={handleBuy}
          disabled={buying || token.decision === 'SKIP'}
        />
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={styles.dataValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a2e',
  },
  headerLeft: {},
  symbol: { color: '#fff', fontSize: 24, fontWeight: '800' },
  name: { color: '#888', fontSize: 14, marginTop: 2 },
  card: {
    margin: 12, padding: 16,
    backgroundColor: '#1a1a2e', borderRadius: 12,
  },
  cardTitle: { color: '#00d4aa', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  dataRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#252540',
  },
  dataLabel: { color: '#888', fontSize: 13 },
  dataValue: { color: '#fff', fontSize: 13, fontWeight: '600' },
  monoText: { color: '#aaa', fontSize: 11, fontFamily: 'monospace' },
  reasonText: { color: '#ccc', fontSize: 12, marginBottom: 4 },
  tradeRow: { paddingHorizontal: 16, marginTop: 12 },
});
