/**
 * ScoreBadge — Visual score indicator with purple gradient for high scores
 * Clean circular design inspired by Phantom wallet badges
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, typography } from '../theme';

interface Props {
  score: number;
  decision?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function ScoreBadge({ score, decision, size = 'md' }: Props) {
  const getColor = () => {
    if (score >= 70) return colors.purple[400];
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
  const badgeSize = 44 * sizeMultiplier;

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
            backgroundColor: `${badgeColor}15`,
          },
        ]}
      >
        <Text
          style={[
            styles.score,
            {
              color: badgeColor,
              fontSize: 14 * sizeMultiplier,
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
  },
  label: {
    ...typography.caption,
    marginTop: 3,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
