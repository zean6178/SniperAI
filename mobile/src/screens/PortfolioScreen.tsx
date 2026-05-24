/**
 * PortfolioScreen — Holdings overview with P&L tracking
 * 
 * Clean summary header with portfolio stats, position cards below.
 * Purple accent for positive metrics, clean grey for neutral.
 */

import React from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { usePortfolio } from '../hooks/usePortfolio';
import { colors, spacing, radius, typography, shadows } from '../theme';

export default function PortfolioScreen() {
  const { positions, summary, isLoading, refresh } = usePortfolio();

  return (
    <View style={styles.container}>
      {/* Portfolio Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.totalLabel}>Total Value</Text>
        <Text style={styles.totalValue}>
          {summary.totalCurrentValueSol.toFixed(3)} SOL
        </Text>
        <View style={styles.pnlRow}>
          <View style={[
            styles.pnlBadge,
            { backgroundColor: summary.totalPnlSol >= 0 ? `${colors.success}20` : `${colors.danger}20` }
          ]}>
            <Text style={[
              styles.pnlText,
              { color: summary.totalPnlSol >= 0 ? colors.success : colors.danger }
            ]}>
              {summary.totalPnlSol >= 0 ? '+' : ''}{summary.totalPnlSol.toFixed(3)} SOL
              ({summary.totalPnlPct >= 0 ? '+' : ''}{summary.totalPnlPct.toFixed(1)}%)
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatItem label="Positions" value={`${summary.totalPositions}`} />
          <View style={styles.statDivider} />
          <StatItem label="Invested" value={`${summary.totalInvestedSol.toFixed(2)} SOL`} />
          <View style={styles.statDivider} />
          <StatItem label="Win Rate" value="—" />
        </View>
      </View>

      {/* Positions List */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Open Positions</Text>
        <Text style={styles.sectionCount}>{positions.length}</Text>
      </View>

      <FlatList
        data={positions}
        keyExtractor={(item) => item.mint}
        renderItem={({ item }) => <PositionCard position={item} />}
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
            <Text style={styles.emptyIcon}>◈</Text>
            <Text style={styles.emptyTitle}>No open positions</Text>
            <Text style={styles.emptySubtext}>
              Tokens you buy will appear here
            </Text>
          </View>
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function PositionCard({ position }: { position: any }) {
  const isProfit = (position.pnlPct || 0) >= 0;
  const pnlColor = isProfit ? colors.success : colors.danger;
  const multiple = (position.currentMultiple || 1).toFixed(2);

  return (
    <View style={styles.posCard}>
      <View style={styles.posHeader}>
        <View style={styles.posLeft}>
          <View style={styles.posAvatar}>
            <Text style={styles.posAvatarText}>
              {(position.symbol || '?')[0]}
            </Text>
          </View>
          <View>
            <Text style={styles.posSymbol}>
              {position.symbol || position.mint?.slice(0, 6)}
            </Text>
            <Text style={styles.posEntry}>
              {position.entryAmountSol?.toFixed(2)} SOL · {position.holdTime}
            </Text>
          </View>
        </View>
        <View style={styles.posRight}>
          <Text style={[styles.posMultiple, { color: pnlColor }]}>{multiple}x</Text>
          <View style={[styles.posPnlBadge, { backgroundColor: `${pnlColor}15` }]}>
            <Text style={[styles.posPnlText, { color: pnlColor }]}>
              {isProfit ? '+' : ''}{(position.pnlPct || 0).toFixed(1)}%
            </Text>
          </View>
        </View>
      </View>

      {/* Progress bar showing peak vs current */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(100, Math.max(0, (position.currentMultiple || 1) / (position.peakMultiple || 2) * 100))}%`,
                backgroundColor: pnlColor,
              }
            ]}
          />
        </View>
        <Text style={styles.progressLabel}>
          Peak: {(position.peakMultiple || 1).toFixed(2)}x
        </Text>
      </View>
    </View>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  summaryCard: {
    margin: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    ...shadows.md,
  },
  totalLabel: {
    ...typography.bodySm,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalValue: {
    ...typography.numberLg,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  pnlRow: {
    marginTop: spacing.sm,
  },
  pnlBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  pnlText: {
    ...typography.label,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border.subtle,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
  },
  statValue: {
    ...typography.label,
    color: colors.text.primary,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
  },
  sectionCount: {
    ...typography.label,
    color: colors.text.tertiary,
    backgroundColor: colors.bg.secondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  posCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  posHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  posLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  posAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  posAvatarText: {
    ...typography.h4,
    color: colors.purple[400],
  },
  posSymbol: {
    ...typography.h4,
    color: colors.text.primary,
  },
  posEntry: {
    ...typography.bodySm,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  posRight: {
    alignItems: 'flex-end',
  },
  posMultiple: {
    ...typography.numberLg,
    fontSize: 20,
  },
  posPnlBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginTop: 4,
  },
  posPnlText: {
    ...typography.numberSm,
  },
  progressContainer: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 3,
    backgroundColor: colors.bg.tertiary,
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressLabel: {
    ...typography.caption,
    color: colors.text.disabled,
  },
  empty: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: spacing.xxxl,
  },
  emptyIcon: {
    fontSize: 48,
    color: colors.purple[400],
    opacity: 0.4,
    marginBottom: spacing.lg,
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
