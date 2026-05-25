/**
 * ScoreBadge — Neon score indicator with cyan glow for high scores
 * Electric Cyan style: circular badge with gradient border feel, neon glow
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, typography, shadows } from '../theme';

interface Props {
  score: number;
  decision?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function ScoreBadge({ score, decision, size = 'md' }: Props) {
  const getColor = () => {
    if (score >= 70) return colors.cyan[400];
    if (score >= 50) return colors.warning;
    return colors.danger;
  };

  const getLabel = () => {
    if (decision === 'SNIPE') return 'SNIPE';
    if (decision === 'WATCH') return 'WATCH';
    return 'SKIP';
  };

  const badgeColor = getColor();
  const sizeMultiplier = size === 'lg' ? 1.4 : size === 'sm' ? 0.8 : 1;
  const badgeSize = 46 * sizeMultiplier;
  const isHighScore = score >= 70;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.badge,
          {
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize / 2,
            borderColor: badgeColor,
            backgroundColor: `${badgeColor}12`,
          },
          isHighScore && {
            shadowColor: badgeColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: 8,
            elevation: 4,
          },
        ]}
      >
        <Text
          style={[
            styles.score,
            {
              color: badgeColor,
              fontSize: 15 * sizeMultiplier,
            },
          ]}
        >
          {score}
        </Text>
      </View>
      {size !== 'sm' && (
        <Text style={[styles.label, { color: badgeColor }]}>
          {getLabel()}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  badge: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  label: {
    ...typography.caption,
    marginTop: 4,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
