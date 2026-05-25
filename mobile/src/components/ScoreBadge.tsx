/**
 * ScoreBadge — Neon score indicator
 * 
 * Circular badge with cyan glow for high scores,
 * clean minimal style matching premium fintech aesthetic.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '../theme';

interface Props {
  score: number;
  decision?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function ScoreBadge({ score, decision, size = 'md' }: Props) {
  const getColor = () => {
    if (score >= 70) return colors.primary.cyan;
    if (score >= 50) return colors.warning;
    return colors.danger;
  };

  const badgeColor = getColor();
  const sizeMultiplier = size === 'lg' ? 1.4 : size === 'sm' ? 0.8 : 1;
  const badgeSize = 44 * sizeMultiplier;
  const isHighScore = score >= 70;

  return (
    <View
      style={[
        styles.badge,
        {
          width: badgeSize,
          height: badgeSize,
          borderRadius: badgeSize / 2,
          borderColor: badgeColor,
          backgroundColor: `${badgeColor}10`,
        },
        isHighScore && {
          shadowColor: badgeColor,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 4,
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
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    fontWeight: '800',
    fontFamily: 'monospace',
  },
});
