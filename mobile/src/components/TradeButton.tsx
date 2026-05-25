/**
 * TradeButton — Premium neon action button
 * 
 * Primary: Gradient pill (#0066FF → #00E5FF) with glow shadow, floating feel
 * Secondary: Transparent glass with thin border
 * Buy/Sell: Colored with subtle glow
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
    if (disabled) return { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' };
    switch (variant) {
      case 'buy': return { backgroundColor: colors.trade.buy };
      case 'sell': return { backgroundColor: colors.trade.sell };
      case 'ghost': return { backgroundColor: 'transparent' };
      case 'outline': return { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: 'rgba(0, 229, 255, 0.4)' };
      default: return {};
    }
  };

  const getTextColor = () => {
    if (disabled) return 'rgba(255,255,255,0.2)';
    switch (variant) {
      case 'buy': return colors.dark.bg;
      case 'sell': return '#FFFFFF';
      case 'ghost': return colors.primary.cyan;
      case 'outline': return colors.primary.cyan;
      default: return '#FFFFFF';
    }
  };

  const getPadding = () => {
    switch (size) {
      case 'sm': return { paddingVertical: 10, paddingHorizontal: 18 };
      case 'lg': return { paddingVertical: 18, paddingHorizontal: 32 };
      default: return { paddingVertical: 14, paddingHorizontal: 24 };
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
        style={[styles.wrapper, fullWidth && styles.fullWidth, shadows.blueGlow]}
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={['#0066FF', '#00E5FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.btn, getPadding()]}
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
  wrapper: {
    borderRadius: radius.button,
    overflow: 'hidden',
    marginVertical: spacing.xs,
  },
  btn: {
    borderRadius: radius.button,
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
