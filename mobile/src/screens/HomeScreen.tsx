/**
 * HomeScreen — Real-time token discovery feed
 * 
 * Clean, minimal layout with purple accent filters.
 * Phantom-wallet-inspired: smooth scrolling, subtle cards, elegant spacing.
 */

import React, { useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity,
} from 'react-native';
import TokenCard from '../components/TokenCard';
import { useTokenFeed } from '../hooks/useTokenFeed';
import { colors, spacing, radius, typography } from '../theme';

type FilterType = 'all' | 'snipe' | 'watch';

export default function HomeScreen({ navigation }: any) {
  const { tokens, isLoading, refresh, isConnected } = useTokenFeed({ minScore: 50 });
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredTokens = tokens.filter(t => {
    if (filter === 'snipe') return t.decision === 'SNIPE';
    if (filter === 'watch') return t.decision === 'WATCH';
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Status indicator */}
      <View style={styles.statusBar}>
        <View style={styles.statusLeft}>
          <View style={[styles.dot, { backgroundColor: isConnected ? colors.success : colors.danger }]} />
          <Text style={styles.statusText}>
            {isConnected ? 'Live' : 'Offline'}
          </Text>
        </View>
        <Text style={styles.countText}>
          {tokens.length} tokens
        </Text>
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {([
          { key: 'all', label: 'All' },
          { key: 'snipe', label: 'Snipe' },
          { key: 'watch', label: 'Watch' },
        ] as const).map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.filterChip, filter === key && styles.filterChipActive]}
            onPress={() => setFilter(key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, filter === key && styles.filterTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Token feed */}
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
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refresh}
            tintColor={colors.purple[400]}
            colors={[colors.purple[400]]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>◎</Text>
            <Text style={styles.emptyTitle}>
              {isLoading ? 'Scanning...' : 'No tokens found'}
            </Text>
            <Text style={styles.emptySubtext}>
              {isLoading ? 'Looking for opportunities' : 'Try adjusting your filters'}
            </Text>
          </View>
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  statusText: {
    ...typography.bodySm,
    color: colors.text.tertiary,
  },
  countText: {
    ...typography.bodySm,
    color: colors.text.tertiary,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  filterChipActive: {
    backgroundColor: colors.purple[500],
    borderColor: colors.purple[500],
  },
  filterText: {
    ...typography.label,
    color: colors.text.tertiary,
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  empty: {
    alignItems: 'center',
    marginTop: 80,
    paddingHorizontal: spacing.xxxl,
  },
  emptyIcon: {
    fontSize: 48,
    color: colors.purple[400],
    marginBottom: spacing.lg,
    opacity: 0.5,
  },
  emptyTitle: {
    ...typography.h4,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    ...typography.bodySm,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
});
