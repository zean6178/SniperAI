/**
 * TokenCard — Glassmorphism card for token feed
 * Electric Cyan style: dark glass background, neon border accents, 
 * cyan glow metrics, futuristic minimal feel
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import ScoreBadge from './ScoreBadge';
import { colors, spacing, radius, typography, shadows, glass } from '../theme';

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
          <View style={styles.avatarContainer}>
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
        <MetricPill label="MC" value={`${(token.marketCapSol || 0).toFixed(1)} SOL`} />
        <MetricPill label="Vol" value={`${(token.volume5mSol || 0).toFixed(1)}`} />
        <MetricPill label="Buys" value={`${token.buyCount5m || 0}`} />
        <MetricPill label="Age" value={age} />
      </View>

      {token.isBundled && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>⚠ Bundled Launch Detected</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
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
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
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
  avatarContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    ...typography.h3,
    color: colors.cyan[400],
  },
  nameContainer: {
    flex: 1,
  },
  symbol: {
    ...typography.h4,
    color: colors.text.primary,
  },
  name: {
    ...typography.bodySm,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  metrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  metric: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValue: {
    ...typography.label,
    color: colors.cyan[400],
    marginTop: 3,
    opacity: 0.9,
  },
  warningBanner: {
    marginTop: spacing.md,
    backgroundColor: 'rgba(255, 61, 113, 0.08)',
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 61, 113, 0.2)',
  },
  warningText: {
    ...typography.labelSm,
    color: colors.danger,
    textAlign: 'center',
  },
});
