/**
 * TokenDetailScreen — Detailed token view with trade execution
 * 
 * Electric Cyan futuristic style: glassmorphism cards, neon data rows,
 * gradient trade buttons, cyan glow accents. Sci-fi terminal feel.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ScoreBadge from '../components/ScoreBadge';
import TradeButton from '../components/TradeButton';
import { useWallet } from '../hooks/useWallet';
import { useTradeFlow } from '../hooks/useTradeFlow';
import { colors, spacing, radius, typography, shadows, glass } from '../theme';

export default function TokenDetailScreen({ route }: any) {
  const { token } = route.params;
  const { isConnected: walletConnected } = useWallet();
  const { executeBuy, executeSell, isBuying, isSelling } = useTradeFlow();
  const [buyAmount] = useState(0.5);

  const handleBuy = async () => {
    if (!walletConnected) {
      Alert.alert('Wallet Required', 'Connect your wallet in Settings to trade.');
      return;
    }
    const result = await executeBuy({ mint: token.mint, amountSol: buyAmount });
    if (result.success) {
      Alert.alert('Trade Executed', `Successfully bought ${token.symbol}\nTx: ${result.txHash?.slice(0, 12)}...`);
    } else {
      Alert.alert('Trade Failed', result.error || 'Unknown error');
    }
  };

  const handleSell = async () => {
    if (!walletConnected) {
      Alert.alert('Wallet Required', 'Connect your wallet in Settings to trade.');
      return;
    }
    const result = await executeSell({ mint: token.mint, sellPct: 100 });
    if (result.success) {
      Alert.alert('Sold', `Successfully sold ${token.symbol}`);
    } else {
      Alert.alert('Sell Failed', result.error || 'Unknown error');
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Token Header */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(token.symbol || '?')[0]}</Text>
          </View>
          <View>
            <Text style={styles.symbol}>{token.symbol || '???'}</Text>
            <Text style={styles.name}>{token.name || 'Unknown Token'}</Text>
          </View>
        </View>
        <ScoreBadge score={token.score} decision={token.decision} size="lg" />
      </View>

      {/* Chart Placeholder */}
      <View style={styles.chartCard}>
        <View style={styles.chartPlaceholder}>
          <Text style={styles.chartLabel}>⚡ Price Chart</Text>
          <View style={styles.chartLine}>
            <LinearGradient
              colors={['#0066FF', '#00E5FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.chartGradientLine}
            />
          </View>
          <Text style={styles.chartSubtext}>Real-time data loading...</Text>
        </View>
      </View>

      {/* Market Data */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleDot} />
          <Text style={styles.cardTitle}>Market Data</Text>
        </View>
        <DataRow label="Market Cap" value={`${(token.marketCapSol || 0).toFixed(2)} SOL`} />
        <DataRow label="Bonding Curve" value={token.bondingCurvePct ? `${token.bondingCurvePct.toFixed(1)}%` : 'N/A'} />
        <DataRow label="Volume (5m)" value={`${(token.volume5mSol || 0).toFixed(2)} SOL`} highlight />
        <DataRow label="Buy Count (5m)" value={`${token.buyCount5m || 0}`} />
        <DataRow label="Unique Buyers" value={`${token.uniqueBuyers || 0}`} />
        <DataRow
          label="Bundled"
          value={token.isBundled ? '⚠ Yes' : '✓ No'}
          valueColor={token.isBundled ? colors.danger : colors.success}
        />
      </View>

      {/* AI Screening Results */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleDot} />
          <Text style={styles.cardTitle}>AI Analysis</Text>
        </View>
        {(token.reasons || []).length > 0 ? (
          (token.reasons || []).map((reason: string, i: number) => (
            <View key={i} style={styles.reasonRow}>
              <View style={styles.reasonDot} />
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.noDataText}>No analysis available</Text>
        )}
      </View>

      {/* Contract Info */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleDot} />
          <Text style={styles.cardTitle}>Contract</Text>
        </View>
        <View style={styles.addressRow}>
          <Text style={styles.addressLabel}>MINT</Text>
          <Text style={styles.addressValue} numberOfLines={1}>{token.mint}</Text>
        </View>
        <View style={styles.addressRow}>
          <Text style={styles.addressLabel}>DEPLOYER</Text>
          <Text style={styles.addressValue} numberOfLines={1}>{token.deployer || 'Unknown'}</Text>
        </View>
      </View>

      {/* Trade Buttons */}
      <View style={styles.tradeSection}>
        <View style={styles.tradeRow}>
          <View style={styles.tradeBtnHalf}>
            <TradeButton
              label={`Buy ${buyAmount} SOL`}
              variant="buy"
              onPress={handleBuy}
              loading={isBuying}
              disabled={token.decision === 'SKIP' || isBuying}
            />
          </View>
          <View style={styles.tradeBtnHalf}>
            <TradeButton
              label="Sell All"
              variant="sell"
              onPress={handleSell}
              loading={isSelling}
              disabled={isSelling}
            />
          </View>
        </View>
        {!walletConnected && (
          <View style={styles.walletHintContainer}>
            <Text style={styles.walletHint}>◈ Connect wallet in Settings to trade</Text>
          </View>
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function DataRow({ label, value, valueColor, highlight }: { label: string; value: string; valueColor?: string; highlight?: boolean }) {
  return (
    <View style={[styles.dataRow, highlight && styles.dataRowHighlight]}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={[styles.dataValue, valueColor ? { color: valueColor } : highlight ? { color: colors.cyan[400] } : {}]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 1,
    borderColor: colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    ...shadows.cyan,
  },
  avatarText: {
    ...typography.h2,
    color: colors.cyan[400],
  },
  symbol: {
    ...typography.h2,
    color: colors.text.primary,
  },
  name: {
    ...typography.bodySm,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  chartCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    ...glass.card,
    overflow: 'hidden',
  },
  chartPlaceholder: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  chartLabel: {
    ...typography.label,
    color: colors.cyan[400],
    marginBottom: spacing.md,
  },
  chartLine: {
    width: '80%',
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: spacing.md,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
  },
  chartGradientLine: {
    width: '60%',
    height: '100%',
    borderRadius: 2,
  },
  chartSubtext: {
    ...typography.caption,
    color: colors.text.disabled,
  },
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    ...glass.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardTitleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.cyan[400],
    marginRight: spacing.sm,
    ...shadows.cyan,
  },
  cardTitle: {
    ...typography.label,
    color: colors.cyan[400],
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  dataRowHighlight: {
    backgroundColor: 'rgba(0, 229, 255, 0.03)',
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.xs,
  },
  dataLabel: {
    ...typography.bodySm,
    color: colors.text.tertiary,
  },
  dataValue: {
    ...typography.label,
    color: colors.text.primary,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  reasonDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.cyan[400],
    marginTop: 6,
    marginRight: spacing.sm,
    opacity: 0.8,
  },
  reasonText: {
    ...typography.bodySm,
    color: colors.text.secondary,
    flex: 1,
  },
  noDataText: {
    ...typography.bodySm,
    color: colors.text.disabled,
    fontStyle: 'italic',
  },
  addressRow: {
    marginBottom: spacing.md,
  },
  addressLabel: {
    ...typography.caption,
    color: colors.cyan[400],
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
    opacity: 0.7,
  },
  addressValue: {
    ...typography.bodySm,
    color: colors.text.secondary,
    fontFamily: 'monospace',
    backgroundColor: 'rgba(0, 229, 255, 0.04)',
    padding: spacing.sm,
    borderRadius: radius.xs,
    overflow: 'hidden',
  },
  tradeSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  tradeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  tradeBtnHalf: {
    flex: 1,
  },
  walletHintContainer: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  walletHint: {
    ...typography.caption,
    color: colors.text.disabled,
    textAlign: 'center',
  },
});
