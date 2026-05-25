/**
 * HomeScreen — Hero with spiral black hole + Token Discovery Feed
 * 
 * Electric Cyan v2: SVG spiral vortex (thin layered paths),
 * floating CTA, glassmorphism feed cards, premium minimal layout.
 * Deep space aesthetic, quantum portal branding.
 */

import React, { useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TouchableOpacity, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import TokenCard from '../components/TokenCard';
import { useTokenFeed } from '../hooks/useTokenFeed';
import { colors, spacing, radius, typography, shadows, glass } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type FilterType = 'all' | 'snipe' | 'watch';

export default function HomeScreen({ navigation }: any) {
  const { tokens, isLoading, refresh, isConnected } = useTokenFeed({ minScore: 50 });
  const [filter, setFilter] = useState<FilterType>('all');
  const [showHero, setShowHero] = useState(true);

  const filteredTokens = tokens.filter(t => {
    if (filter === 'snipe') return t.decision === 'SNIPE';
    if (filter === 'watch') return t.decision === 'WATCH';
    return true;
  });

  if (showHero && tokens.length === 0) {
    return (
      <View style={styles.container}>
        <HeroSection onStart={() => setShowHero(false)} navigation={navigation} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.feedHeader}>
        <Text style={styles.feedTitle}>Discover</Text>
        <View style={styles.liveIndicator}>
          <View style={[styles.liveDot, { backgroundColor: isConnected ? colors.success : colors.danger }]} />
          <Text style={styles.liveText}>{isConnected ? 'Live' : 'Offline'}</Text>
        </View>
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {([
          { key: 'all', label: 'All' },
          { key: 'snipe', label: '⚡ Snipe' },
          { key: 'watch', label: '◉ Watch' },
        ] as const).map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.filterChip, filter === key && styles.filterChipActive]}
            onPress={() => setFilter(key)}
            activeOpacity={0.7}
          >
            {filter === key ? (
              <LinearGradient
                colors={['#0066FF', '#00B8FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.filterGradient}
              >
                <Text style={styles.filterTextActive}>{label}</Text>
              </LinearGradient>
            ) : (
              <Text style={styles.filterText}>{label}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Token feed */}
      <FlatList
        data={filteredTokens}
        keyExtractor={(item) => item.mint}
        renderItem={({ item }) => (
          <TokenCard
            token={item}
            onPress={() => navigation.navigate('TokenDetail', { mint: item.mint, token: item })}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refresh}
            tintColor={colors.primary.cyan}
            colors={[colors.primary.cyan]}
          />
        }
        ListEmptyComponent={<EmptyState isLoading={isLoading} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// HERO SECTION — Spiral Black Hole
// ═══════════════════════════════════════════════════════════════════════════════

function HeroSection({ onStart, navigation }: { onStart: () => void; navigation: any }) {
  return (
    <View style={styles.heroContainer}>
      {/* Spiral Black Hole SVG */}
      <View style={styles.blackholeWrapper}>
        <Svg width={240} height={240} viewBox="0 0 240 240">
          <Defs>
            <SvgGradient id="spiral1" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#0066FF" stopOpacity={0.8} />
              <Stop offset="50%" stopColor="#00E5FF" stopOpacity={0.6} />
              <Stop offset="100%" stopColor="#00B8FF" stopOpacity={0.2} />
            </SvgGradient>
            <SvgGradient id="spiral2" x1="100%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#00E5FF" stopOpacity={0.6} />
              <Stop offset="100%" stopColor="#0066FF" stopOpacity={0.1} />
            </SvgGradient>
            <SvgGradient id="spiral3" x1="0%" y1="100%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#00B8FF" stopOpacity={0.5} />
              <Stop offset="100%" stopColor="#0066FF" stopOpacity={0.1} />
            </SvgGradient>
          </Defs>

          {/* Outer soft rings */}
          <Circle cx={120} cy={120} r={110} stroke="rgba(0,229,255,0.03)" strokeWidth={1} fill="none" />
          <Circle cx={120} cy={120} r={95} stroke="rgba(0,229,255,0.05)" strokeWidth={0.5} fill="none" />

          {/* Spiral arm 1 — main */}
          <Path
            d="M120 120 C120 80, 160 80, 160 120 C160 150, 130 160, 120 160 C100 160, 85 145, 85 120 C85 90, 105 75, 130 75 C165 75, 180 100, 180 120 C180 155, 155 180, 120 180 C80 180, 60 150, 60 120 C60 80, 90 55, 130 55 C175 55, 200 90, 200 120 C200 165, 170 200, 120 200"
            stroke="url(#spiral1)"
            strokeWidth={1.2}
            fill="none"
            opacity={0.7}
            strokeLinecap="round"
          />

          {/* Spiral arm 2 */}
          <Path
            d="M120 120 C120 95, 145 90, 150 120 C155 145, 135 155, 120 155 C100 155, 90 140, 90 120 C90 95, 108 82, 130 82 C158 82, 172 102, 172 120 C172 148, 150 170, 120 170 C88 170, 68 148, 68 120 C68 85, 95 62, 130 62 C170 62, 192 92, 192 120"
            stroke="url(#spiral2)"
            strokeWidth={0.8}
            fill="none"
            opacity={0.5}
            strokeLinecap="round"
          />

          {/* Spiral arm 3 — innermost */}
          <Path
            d="M120 120 C118 105, 135 100, 140 118 C145 138, 130 148, 118 145 C105 142, 98 130, 100 118 C103 100, 115 90, 132 92 C152 94, 162 112, 160 128 C157 150, 140 165, 118 163 C95 160, 80 142, 82 120 C85 95, 105 78, 130 78"
            stroke="url(#spiral3)"
            strokeWidth={0.6}
            fill="none"
            opacity={0.35}
            strokeLinecap="round"
          />

          {/* Center void */}
          <Circle cx={120} cy={120} r={18} fill="#0A1120" />
          <Circle cx={120} cy={120} r={12} fill="#050810" />
          <Circle cx={120} cy={120} r={5} fill="#000" />

          {/* Glow rings around center */}
          <Circle cx={120} cy={120} r={22} stroke="rgba(0,229,255,0.3)" strokeWidth={0.8} fill="none" />
          <Circle cx={120} cy={120} r={28} stroke="rgba(0,229,255,0.12)" strokeWidth={0.5} fill="none" />
        </Svg>

        {/* Micro particles */}
        <View style={[styles.particle, { top: 25, left: 65 }]} />
        <View style={[styles.particle, { top: 50, right: 50 }]} />
        <View style={[styles.particleSm, { bottom: 45, left: 48 }]} />
        <View style={[styles.particle, { bottom: 30, right: 58 }]} />
        <View style={[styles.particleSm, { top: 75, left: 28 }]} />
        <View style={[styles.particleSm, { top: 35, right: 80 }]} />
      </View>

      {/* Title */}
      <Text style={styles.heroTitle}>Sniper</Text>
      <Text style={styles.heroSubtitle}>AI-Powered Token Intelligence</Text>

      {/* Primary CTA — Gradient pill */}
      <TouchableOpacity style={styles.ctaWrapper} onPress={onStart} activeOpacity={0.85}>
        <LinearGradient
          colors={['#0066FF', '#00E5FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.ctaBtn}
        >
          <Text style={styles.ctaText}>⚡ Start Sniping</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Secondary — glass wallet button */}
      <TouchableOpacity
        style={styles.walletBtn}
        onPress={() => navigation.navigate('Profile')}
        activeOpacity={0.7}
      >
        <Text style={styles.walletBtnText}>◈ Connect Wallet</Text>
      </TouchableOpacity>
    </View>
  );
}


function EmptyState({ isLoading }: { isLoading: boolean }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Text style={styles.emptyIconText}>◎</Text>
      </View>
      <Text style={styles.emptyTitle}>
        {isLoading ? 'Scanning Blockchain...' : 'No tokens found'}
      </Text>
      <Text style={styles.emptySubtext}>
        {isLoading ? 'AI is analyzing new launches' : 'Try adjusting your filters'}
      </Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.bg,
  },

  // ——— HERO ———
  heroContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  blackholeWrapper: {
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  particle: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#00E5FF',
    opacity: 0.7,
  },
  particleSm: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#00E5FF',
    opacity: 0.4,
  },
  heroTitle: {
    ...typography.hero,
    color: colors.textDark.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    ...typography.heroSub,
    color: colors.textDark.tertiary,
    textAlign: 'center',
    marginBottom: spacing.hero,
  },
  ctaWrapper: {
    width: '100%',
    maxWidth: 280,
    borderRadius: radius.button,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    ...shadows.ctaGlow,
  },
  ctaBtn: {
    paddingVertical: 18,
    paddingHorizontal: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
  },
  ctaText: {
    ...typography.button,
    color: '#FFFFFF',
  },
  walletBtn: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  walletBtnText: {
    ...typography.buttonSm,
    color: 'rgba(0, 229, 255, 0.9)',
  },


  // ——— FEED ———
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  feedTitle: {
    ...typography.h2,
    color: colors.textDark.primary,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    ...typography.bodySm,
    color: colors.textDark.tertiary,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  filterChip: {
    borderRadius: radius.button,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  filterChipActive: {
    borderColor: 'transparent',
    ...shadows.cyanGlow,
  },
  filterGradient: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: radius.button,
  },
  filterText: {
    ...typography.label,
    color: 'rgba(255, 255, 255, 0.4)',
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  filterTextActive: {
    ...typography.label,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: 100, // space for floating nav
  },
  empty: {
    alignItems: 'center',
    marginTop: 80,
    paddingHorizontal: spacing.xxxl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 229, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.borderDark.default,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyIconText: {
    fontSize: 28,
    color: colors.primary.cyan,
    opacity: 0.7,
  },
  emptyTitle: {
    ...typography.h4,
    color: colors.textDark.secondary,
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    ...typography.bodySm,
    color: colors.textDark.tertiary,
    textAlign: 'center',
  },
});
