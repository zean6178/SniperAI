/**
 * TradeButton — Stylized action button for buy/sell
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';

interface Props {
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export default function TradeButton({ label, color, onPress, disabled, loading }: Props) {
  return (
    <TouchableOpacity
      style={[styles.btn, { backgroundColor: disabled ? '#333' : color }]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color="#000" />
      ) : (
        <Text style={[styles.label, { color: disabled ? '#666' : '#000' }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
    marginVertical: 4,
  },
  label: { fontSize: 16, fontWeight: '800' },
});
