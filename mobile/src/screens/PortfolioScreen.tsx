/**
 * PortfolioScreen — Open positions + PnL + history
 */

import React from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { usePortfolio } from '../hooks/usePortfolio';

export default function PortfolioScreen() {
  const { positions, summary, isLoading, refresh } = usePortfolio();

  return (
    <View style={styles.container}>
      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Portfolio</Text>
        <View style={styles.summaryRow}>
          <SummaryItem label="Positions" value={`${summary.totalPositions}`} />
          <SummaryItem label="Invested" value={`${summary.totalInvestedSol.toFixed(2)} SOL`} />
          <SummaryItem
            label="PnL"
            value={`${summary.totalPnlSol >= 0 ? '+' : ''}${summary.totalPnlSol.toFixed(3)} SOL`}
            color={summary.totalPnlSol >= 0 ? '#00d4aa' : '#ff4444'}
          />
        </View>
      </View>

      {/* Positions List */}
      <FlatList
        data={positions}
        keyExtractor={(item) => item.mint}
        renderItem={({ item }) => <PositionRow position={item} />}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor="#00d4aa" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>📭 No open positions</Text>
            <Text style={styles.emptySubtext}>Snipe a token from the Feed tab!</Text>
          </View>
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

function PositionRow({ position }: { position: any }) {
  const pnlColor = (position.pnlPct || 0) >= 0 ? '#00d4aa' : '#ff4444';
  const multiple = (position.currentMultiple || 1).toFixed(2);

  return (
    <View style={styles.posRow}>
      <View style={styles.posLeft}>
        <Text style={styles.posSymbol}>{position.symbol || position.mint?.slice(0, 6)}</Text>
        <Text style={styles.posEntry}>{position.entryAmountSol?.toFixed(2)} SOL → {position.holdTime}</Text>
      </View>
      <View style={styles.posRight}>
        <Text style={[styles.posMultiple, { color: pnlColor }]}>{multiple}x</Text>
        <Text style={[styles.posPnl, { color: pnlColor }]}>
          {position.pnlPct >= 0 ? '+' : ''}{(position.pnlPct || 0).toFixed(1)}%
        </Text>
      </View>
    </View>
  );
}

function SummaryItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  summaryCard: {
    margin: 12, padding: 16,
    backgroundColor: '#1a1a2e', borderRadius: 12,
  },
  summaryTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryItem: { alignItems: 'center' },
  summaryLabel: { color: '#888', fontSize: 11 },
  summaryValue: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 4 },
  list: { paddingHorizontal: 12 },
  posRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#1a1a2e', borderRadius: 10, padding: 14, marginBottom: 8,
  },
  posLeft: {},
  posSymbol: { color: '#fff', fontSize: 16, fontWeight: '700' },
  posEntry: { color: '#888', fontSize: 11, marginTop: 2 },
  posRight: { alignItems: 'flex-end' },
  posMultiple: { fontSize: 18, fontWeight: '800' },
  posPnl: { fontSize: 12, marginTop: 2 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#666', fontSize: 16 },
  emptySubtext: { color: '#555', fontSize: 13, marginTop: 4 },
});
