/**
 * HomeScreen — Real-time token feed with score cards
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity,
} from 'react-native';
import TokenCard from '../components/TokenCard';
import { useTokenFeed } from '../hooks/useTokenFeed';

export default function HomeScreen({ navigation }: any) {
  const { tokens, isLoading, refresh, isConnected } = useTokenFeed({ minScore: 50 });
  const [filter, setFilter] = useState<'all' | 'snipe' | 'watch'>('all');

  const filteredTokens = tokens.filter(t => {
    if (filter === 'snipe') return t.decision === 'SNIPE';
    if (filter === 'watch') return t.decision === 'WATCH';
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Connection Status */}
      <View style={styles.statusBar}>
        <View style={[styles.dot, { backgroundColor: isConnected ? '#00d4aa' : '#ff4444' }]} />
        <Text style={styles.statusText}>
          {isConnected ? 'Live' : 'Connecting...'} • {tokens.length} tokens
        </Text>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        {(['all', 'snipe', 'watch'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? '📋 All' : f === 'snipe' ? '🎯 Snipe' : '👀 Watch'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Token Feed */}
      <FlatList
        data={filteredTokens}
        keyExtractor={(item) => item.mint}
        renderItem={({ item }) => (
          <TokenCard
            token={item}
            onPress={() => navigation.navigate('TokenDetail', { mint: item.mint, token: item })}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor="#00d4aa" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {isLoading ? '🔍 Scanning for tokens...' : '📭 No tokens match your filters'}
            </Text>
          </View>
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  statusBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#1a1a2e',
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { color: '#888', fontSize: 12 },
  filterRow: {
    flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 16, backgroundColor: '#1a1a2e',
  },
  filterBtnActive: { backgroundColor: '#00d4aa' },
  filterText: { color: '#aaa', fontSize: 13 },
  filterTextActive: { color: '#000', fontWeight: '700' },
  list: { paddingHorizontal: 12, paddingBottom: 20 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#666', fontSize: 16 },
});
