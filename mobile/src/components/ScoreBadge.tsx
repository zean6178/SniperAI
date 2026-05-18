/**
 * ScoreBadge — Visual score indicator
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  score: number;
  decision?: string;
}

export default function ScoreBadge({ score, decision }: Props) {
  const color = score >= 70 ? '#00d4aa' : score >= 50 ? '#f0ad4e' : '#ff4444';
  const emoji = decision === 'SNIPE' ? '🎯' : decision === 'WATCH' ? '👀' : '❌';

  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.score, { color }]}>{score}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 2, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
    gap: 4,
  },
  emoji: { fontSize: 14 },
  score: { fontSize: 16, fontWeight: '900' },
});
