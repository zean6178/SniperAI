/**
 * TradeButton — Futuristic neon action button
 * 
 * Electric Cyan style: gradient primary, neon glow, glassmorphism ghost.
 * Rounded full corners, sci-fi feel.
 * Supports: primary (gradient), buy (green glow), sell (red glow), ghost, outline
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
  const isGradient = variant === 'primary' && !disabled;

  const getButtonStyle = () => {
    if (disabled) return { backgroundColor: colors.bg.tertiary, borderWidth: 1, borderColor: colors.border.subtle };
    switch (variant) {
      case 'buy': return { backgroundColor: colors.trade.buy, ...shadows.sm };
      case 'sell': return { backgroundColor: colors.trade.sell, ...shadows.sm };
      case 'ghost': return { backgroundColor: 'transparent' };
      case 'outline': return { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.cyan[400] };
      default: return {};
    }
  };

  const getTextColor = () => {
    if (disabled) return colors.text.disabled;
    switch (variant) {
      case 'buy': return colors.bg.primary;
      case 'sell': return '#FFFFFF';
      case 'ghost': return colors.cyan[400];
      case 'outline': return colors.cyan[400];
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

  const content = (
    <>
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
    </>
  );

  if (isGradient) {
    return (
      <TouchableOpacity
        style={[styles.btnWrapper, fullWidth && styles.fullWidth, shadows.cyan]}
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#0066FF', '#00E5FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.btn, getPadding(), styles.gradientBtn]}
        >
          {content}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

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
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btnWrapper: {
    borderRadius: radius.md,
    overflow: 'hidden',
    marginVertical: spacing.xs,
  },
  btn: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.xs,
  },
  gradientBtn: {
    marginVertical: 0,
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
