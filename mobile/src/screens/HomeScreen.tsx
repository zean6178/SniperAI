/**
 * HomeScreen — Futuristic landing with Black Hole hero + Token Discovery Feed
 * 
 * Electric Cyan style: black hole animation center, large "Sniper" title,
 * primary CTA gradient button, secondary wallet button, bottom navigation.
 * Sci-fi operating system feel with neon cyan glow.
 */

import React, { useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity,
  Animated, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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

  const HeroSection = () => (
    <View style={styles.heroContainer}>
      {/* Black Hole Visual */}
      <View style={styles.blackHoleContainer}>
        {/* Outer orbit rings */}
        <View style={[styles.orbitRing, styles.orbitRing3]} />
        <View style={[styles.orbitRing, styles.orbitRing2]} />
        <View style={[styles.orbitRing, styles.orbitRing1]} />
        
        {/* Core glow */}
        <View style={styles.blackHoleCore}>
          <View style={styles.blackHoleInner}>
            <View style={styles.blackHoleDot} />
          </View>
        </View>

        {/* Particle dots */}
        <View style={[styles.particle, { top: 30, left: 60 }]} />
        <View style={[styles.particle, { top: 45, right: 50 }]} />
        <View style={[styles.particle, { bottom: 40, left: 45 }]} />
        <View style={[styles.particle, { bottom: 25, right: 65 }]} />
        <View style={[styles.particleSm, { top: 20, right: 80 }]} />
        <View style={[styles.particleSm, { bottom: 55, left: 80 }]} />
      </View>

      {/* Title */}
      <Text style={styles.heroTitle}>Sniper</Text>
      <Text style={styles.heroSubtitle}>AI-Powered Token Intelligence</Text>

      {/* Primary CTA Button */}
      <TouchableOpacity
        style={styles.ctaButton}
        onPress={() => setShowHero(false)}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={['#0066FF', '#00E5FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.ctaGradient}
        >
          <Text style={styles.ctaText}>⚡ Start Sniping</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Secondary Wallet Button */}
      <TouchableOpacity
        style={styles.walletButton}
        onPress={() => navigation.navigate('Settings')}
        activeOpacity={0.7}
      >
        <Text style={styles.walletButtonIcon}>◈</Text>
        <Text style={styles.walletButtonText}>Connect Wallet</Text>
      </TouchableOpacity>
    </View>
  );

  if (showHero && tokens.length === 0) {
    return (
      <View style={styles.container}>
        <HeroSection />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Status indicator */}
      <View style={styles.statusBar}>
        <View style={styles.statusLeft}>
          <View style={[styles.dot, { backgroundColor: isConnected ? colors.success : colors.danger }]} />
          <Text style={styles.statusText}>
            {isConnected ? 'Live Feed' : 'Offline'}
          </Text>
        </View>
        <View style={styles.statusRight}>
          <Text style={styles.countText}>{tokens.length} tokens</Text>
        </View>
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {([
          { key: 'all', label: '◎ All' },
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
                colors={['#0066FF', '#00E5FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.filterChipGradient}
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
            tintColor={colors.cyan[400]}
            colors={[colors.cyan[400]]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconContainer}>
              <Text style={styles.emptyIcon}>◎</Text>
            </View>
            <Text style={styles.emptyTitle}>
              {isLoading ? 'Scanning Blockchain...' : 'No tokens found'}
            </Text>
            <Text style={styles.emptySubtext}>
              {isLoading ? 'AI is analyzing new launches' : 'Try adjusting your filters'}
            </Text>
          </View>
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },

  // ═══════════ HERO SECTION ═══════════
  heroContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
  },
  blackHoleContainer: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxxl,
  },
  orbitRing: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
  },
  orbitRing1: {
    width: 100,
    height: 100,
    borderColor: 'rgba(0, 229, 255, 0.4)',
  },
  orbitRing2: {
    width: 150,
    height: 150,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  orbitRing3: {
    width: 200,
    height: 200,
    borderColor: 'rgba(0, 102, 255, 0.12)',
  },
  blackHoleCore: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.cyanStrong,
  },
  blackHoleInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 102, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blackHoleDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.cyan[400],
    ...shadows.cyan,
  },
  particle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.cyan[400],
    opacity: 0.8,
  },
  particleSm: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.cyan[400],
    opacity: 0.5,
  },
  heroTitle: {
    ...typography.hero,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    ...typography.heroSub,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginBottom: spacing.section,
  },
  ctaButton: {
    width: '100%',
    maxWidth: 280,
    borderRadius: radius.full,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    ...shadows.cyan,
  },
  ctaGradient: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  ctaText: {
    ...typography.button,
    color: colors.white,
    fontWeight: '700',
  },
  walletButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: radius.full,
    backgroundColor: 'rgba(10, 26, 46, 0.8)',
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  walletButtonIcon: {
    fontSize: 16,
    color: colors.cyan[400],
    marginRight: spacing.sm,
  },
  walletButtonText: {
    ...typography.buttonSm,
    color: colors.cyan[400],
  },

  // ═══════════ FEED SECTION ═══════════
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  statusText: {
    ...typography.bodySm,
    color: colors.text.tertiary,
  },
  countText: {
    ...typography.bodySm,
    color: colors.cyan[400],
    opacity: 0.7,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  filterChip: {
    borderRadius: radius.full,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    overflow: 'hidden',
  },
  filterChipActive: {
    borderColor: 'transparent',
    ...shadows.cyan,
  },
  filterChipGradient: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  filterText: {
    ...typography.label,
    color: colors.text.tertiary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  filterTextActive: {
    ...typography.label,
    color: '#FFFFFF',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  empty: {
    alignItems: 'center',
    marginTop: 80,
    paddingHorizontal: spacing.xxxl,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyIcon: {
    fontSize: 32,
    color: colors.cyan[400],
  },
  emptyTitle: {
    ...typography.h4,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    ...typography.bodySm,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
});
