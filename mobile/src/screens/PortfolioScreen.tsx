/**
 * PortfolioScreen — Holdings overview with P&L tracking
 * 
 * Electric Cyan style: Glassmorphism summary card with neon glow,
 * position cards with gradient accents, futuristic progress bars.
 * Deep space aesthetic with high contrast.
 */

import React from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { usePortfolio } from '../hooks/usePortfolio';
import { colors, spacing, radius, typography, shadows, glass } from '../theme';

export default function PortfolioScreen() {
  const { positions, summary, isLoading, refresh } = usePortfolio();

  return (
    <View style={styles.container}>
      {/* Portfolio Summary Card */}
      <View style={styles.summaryCard}>
        {/* Subtle top glow line */}
        <LinearGradient
          colors={['#0066FF', '#00E5FF', '#0066FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.summaryGlowLine}
        />
        
        <Text style={styles.totalLabel}>TOTAL VALUE</Text>
        <Text style={styles.totalValue}>
          {summary.totalCurrentValueSol.toFixed(3)} SOL
        </Text>
        <View style={styles.pnlRow}>
          <View style={[
            styles.pnlBadge,
            { backgroundColor: summary.totalPnlSol >= 0 ? 'rgba(0, 230, 118, 0.12)' : 'rgba(255, 61, 113, 0.12)' }
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
        <View style={styles.sectionLeft}>
          <View style={styles.sectionDot} />
          <Text style={styles.sectionTitle}>Open Positions</Text>
        </View>
        <View style={styles.sectionCountBadge}>
          <Text style={styles.sectionCount}>{positions.length}</Text>
        </View>
      </View>

      <FlatList
        data={positions}
        keyExtractor={(item) => item.mint}
        renderItem={({ item }) => <PositionCard position={item} />}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refresh}
            tintColor={colors.cyan[400]}
            colors={[colors.cyan[400]]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconContainer}>
              <Text style={styles.emptyIcon}>◈</Text>
            </View>
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
          <View style={[styles.posPnlBadge, { backgroundColor: `${pnlColor}18` }]}>
            <Text style={[styles.posPnlText, { color: pnlColor }]}>
              {isProfit ? '+' : ''}{(position.pnlPct || 0).toFixed(1)}%
            </Text>
          </View>
        </View>
      </View>

      {/* Progress bar showing peak vs current */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <LinearGradient
            colors={isProfit ? ['#0066FF', '#00E5FF'] : ['#FF3D71', '#FF6B9D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.progressFill,
              {
                width: `${Math.min(100, Math.max(5, (position.currentMultiple || 1) / (position.peakMultiple || 2) * 100))}%`,
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
    ...glass.card,
    borderColor: colors.border.strong,
    overflow: 'hidden',
    ...shadows.md,
  },
  summaryGlowLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.6,
  },
  totalLabel: {
    ...typography.caption,
    color: colors.cyan[400],
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: spacing.sm,
  },
  totalValue: {
    ...typography.numberLg,
    color: colors.text.primary,
    marginTop: spacing.sm,
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
    backgroundColor: colors.border.default,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  sectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.cyan[400],
    marginRight: spacing.sm,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
  },
  sectionCountBadge: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  sectionCount: {
    ...typography.labelSm,
    color: colors.cyan[400],
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  posCard: {
    ...glass.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
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
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  posAvatarText: {
    ...typography.h4,
    color: colors.cyan[400],
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
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
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
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 229, 255, 0.06)',
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyIcon: {
    fontSize: 28,
    color: colors.cyan[400],
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
