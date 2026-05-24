/**
 * TradeButton — Phantom-wallet-inspired action button
 * 
 * Clean, rounded, with subtle gradient feel.
 * Supports: primary (purple), buy (green), sell (red), ghost (outline)
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { colors, radius, spacing, typography, shadows } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'buy' | 'sell' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  fullWidth?: boolean;
}

export default function TradeButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  icon,
  fullWidth = true,
}: Props) {
  const getButtonStyle = () => {
    if (disabled) return { backgroundColor: colors.bg.tertiary };
    switch (variant) {
      case 'buy': return { backgroundColor: colors.trade.buy };
      case 'sell': return { backgroundColor: colors.trade.sell };
      case 'ghost': return { backgroundColor: 'transparent' };
      case 'outline': return { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.purple[400] };
      default: return { backgroundColor: colors.purple[500], ...shadows.purple };
    }
  };

  const getTextColor = () => {
    if (disabled) return colors.text.disabled;
    switch (variant) {
      case 'buy': return colors.bg.primary;
      case 'sell': return '#FFF';
      case 'ghost': return colors.purple[400];
      case 'outline': return colors.purple[400];
      default: return '#FFFFFF';
    }
  };

  const getPadding = () => {
    switch (size) {
      case 'sm': return { paddingVertical: 10, paddingHorizontal: 16 };
      case 'lg': return { paddingVertical: 18, paddingHorizontal: 28 };
      default: return { paddingVertical: 14, paddingHorizontal: 22 };
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'sm': return 13;
      case 'lg': return 17;
      default: return 15;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.btn,
        getButtonStyle(),
        getPadding(),
        fullWidth && styles.fullWidth,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <View style={styles.content}>
          {icon && <Text style={[styles.icon, { color: getTextColor() }]}>{icon}</Text>}
          <Text style={[styles.label, { color: getTextColor(), fontSize: getFontSize() }]}>
            {label}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.xs,
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 16,
  },
  label: {
    fontWeight: '700',
  },
});
