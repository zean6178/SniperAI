/**
 * TokenCard — Premium glassmorphism card for token feed
 * 
 * Transparent dark glass, thin cyan border, rounded XL corners,
 * rounded-square avatar, minimal metric layout.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import ScoreBadge from './ScoreBadge';
import { colors, spacing, radius, typography, glass } from '../theme';

interface Props {
  token: any;
  onPress: () => void;
}

export default function TokenCard({ token, onPress }: Props) {
  const age = getAge(token.detectedAt);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.header}>
        <View style={styles.tokenInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(token.symbol || '?')[0]}
            </Text>
          </View>
          <View style={styles.nameContainer}>
            <Text style={styles.symbol}>{token.symbol || '???'}</Text>
            <Text style={styles.name} numberOfLines={1}>{token.name || 'Unknown Token'}</Text>
          </View>
        </View>
        <ScoreBadge score={token.score} decision={token.decision} />
      </View>

      <View style={styles.metrics}>
        <Metric label="MC" value={`${(token.marketCapSol || 0).toFixed(1)}`} />
        <Metric label="Vol" value={`${(token.volume5mSol || 0).toFixed(1)}`} />
        <Metric label="Buys" value={`${token.buyCount5m || 0}`} />
        <Metric label="Age" value={age} />
      </View>

      {token.isBundled && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>⚠ Bundled Launch Detected</Text>
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
    ...glass.card,
    padding: 18,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.avatar,
    backgroundColor: 'rgba(0, 102, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 102, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primary.soft,
  },
  nameContainer: {
    flex: 1,
  },
  symbol: {
    ...typography.h4,
    color: colors.textDark.primary,
  },
  name: {
    ...typography.bodySm,
    color: colors.textDark.tertiary,
    marginTop: 2,
  },
  metrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
  },
  metric: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    ...typography.labelSm,
    color: colors.textDark.tertiary,
    textTransform: 'uppercase',
  },
  metricValue: {
    ...typography.label,
    color: 'rgba(0, 229, 255, 0.8)',
    marginTop: 4,
  },
  warning: {
    marginTop: 12,
    backgroundColor: 'rgba(255, 61, 113, 0.06)',
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 61, 113, 0.15)',
  },
  warningText: {
    ...typography.labelSm,
    color: colors.danger,
    textAlign: 'center',
    fontSize: 11,
  },
});
