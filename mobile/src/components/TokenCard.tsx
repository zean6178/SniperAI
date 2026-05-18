/**
 * TokenCard — Compact card for token feed
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import ScoreBadge from './ScoreBadge';

interface Props {
  token: any;
  onPress: () => void;
}

export default function TokenCard({ token, onPress }: Props) {
  const age = getAge(token.detectedAt);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={styles.symbol}>{token.symbol || '???'}</Text>
          <Text style={styles.name} numberOfLines={1}>{token.name || 'Unknown'}</Text>
        </View>
        <ScoreBadge score={token.score} decision={token.decision} />
      </View>

      <View style={styles.metrics}>
        <Metric label="MC" value={`${(token.marketCapSol || 0).toFixed(1)} SOL`} />
        <Metric label="Vol 5m" value={`${(token.volume5mSol || 0).toFixed(1)} SOL`} />
        <Metric label="Buys" value={`${token.buyCount5m || 0}`} />
        <Metric label="Age" value={age} />
      </View>

      {token.isBundled && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>🚫 Bundled Launch</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function getAge(detectedAt: string): string {
  if (!detectedAt) return '?';
  const ms = Date.now() - new Date(detectedAt).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a2e', borderRadius: 12,
    padding: 14, marginBottom: 8,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  left: { flex: 1 },
  symbol: { color: '#fff', fontSize: 18, fontWeight: '800' },
  name: { color: '#888', fontSize: 12, marginTop: 2 },
  metrics: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: '#252540',
  },
  metric: { alignItems: 'center' },
  metricLabel: { color: '#666', fontSize: 10 },
  metricValue: { color: '#ccc', fontSize: 12, fontWeight: '600', marginTop: 2 },
  warning: {
    marginTop: 8, backgroundColor: '#3d1515', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8,
  },
  warningText: { color: '#ff6b6b', fontSize: 11, fontWeight: '600' },
});
