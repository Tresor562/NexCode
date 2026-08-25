import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { shadows, theme } from './theme';
import { useMotionPreferences } from './motionPreferences';

type CardTone = 'default' | 'primary' | 'success';
type PillTone = 'neutral' | 'success' | 'primary' | 'warning';

export function Card({ children, style, tone = 'default' }: { children: React.ReactNode; style?: ViewStyle | ViewStyle[]; tone?: CardTone }) {
  return <View style={[styles.card, tone === 'primary' && styles.cardPrimary, tone === 'success' && styles.cardSuccess, style]}>{children}</View>;
}

export function GlassCard({ children, style }: { children: React.ReactNode; style?: ViewStyle | ViewStyle[] }) {
  return <View style={[styles.glassCard, style]}>{children}</View>;
}

export function ProgressBar({ value, label = 'Progression' }: { value: number; label?: string }) {
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  const { reduceMotion, appActive } = useMotionPreferences();
  const animatedValue = useRef(new Animated.Value(safeValue)).current;

  useEffect(() => {
    animatedValue.stopAnimation();
    if (reduceMotion || !appActive) {
      animatedValue.setValue(safeValue);
      return;
    }
    Animated.timing(animatedValue, {
      toValue: safeValue,
      duration: 260,
      useNativeDriver: false,
    }).start();
    return () => animatedValue.stopAnimation();
  }, [animatedValue, appActive, reduceMotion, safeValue]);

  const width = animatedValue.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View
      accessible
      accessibilityLabel={`${label} ${Math.round(safeValue)} %`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(safeValue) }}
      style={styles.progressTrack}
    >
      <Animated.View style={[styles.progressValue, { width }]} />
    </View>
  );
}

function TactileButton({
  children,
  onPress,
  disabled,
  style,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  style: ViewStyle;
  accessibilityLabel: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const depth = useRef(new Animated.Value(0)).current;
  const { reduceMotion, appActive } = useMotionPreferences();

  useEffect(() => {
    if (appActive && !reduceMotion) return;
    scale.stopAnimation();
    depth.stopAnimation();
    scale.setValue(1);
    depth.setValue(0);
  }, [appActive, depth, reduceMotion, scale]);

  useEffect(() => () => {
    scale.stopAnimation();
    depth.stopAnimation();
  }, [depth, scale]);

  const animate = (pressed: boolean) => {
    const nextScale = pressed ? theme.motion.pressedScale : 1;
    const nextDepth = pressed ? theme.motion.pressedDepth : 0;
    if (reduceMotion || !appActive) {
      scale.stopAnimation();
      depth.stopAnimation();
      scale.setValue(nextScale);
      depth.setValue(nextDepth);
      return;
    }
    Animated.parallel([
      Animated.spring(scale, {
        toValue: nextScale,
        useNativeDriver: true,
        speed: theme.motion.springSpeed,
        bounciness: theme.motion.springBounciness,
      }),
      Animated.spring(depth, {
        toValue: nextDepth,
        useNativeDriver: true,
        speed: theme.motion.springSpeed,
        bounciness: 0,
      }),
    ]).start();
  };

  return (
    <Animated.View style={{ transform: [{ translateY: depth }, { scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: Boolean(disabled) }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => animate(true)}
        onPressOut={() => animate(false)}
        style={[style, disabled && styles.disabled]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export function PrimaryButton({ label, onPress, disabled = false, icon }: { label: string; onPress: () => void; disabled?: boolean; icon?: string }) {
  return (
    <TactileButton accessibilityLabel={label} onPress={onPress} disabled={disabled} style={styles.primaryButton}>
      <View style={styles.buttonRow}>
        {icon ? <Text style={styles.primaryButtonIcon}>{icon}</Text> : null}
        <Text style={styles.primaryButtonText}>{label}</Text>
      </View>
    </TactileButton>
  );
}

export function SecondaryButton({ label, onPress, icon }: { label: string; onPress: () => void; icon?: string }) {
  return (
    <TactileButton accessibilityLabel={label} onPress={onPress} style={styles.secondaryButton}>
      <View style={styles.buttonRow}>
        {icon ? <Text style={styles.secondaryButtonText}>{icon}</Text> : null}
        <Text style={styles.secondaryButtonText}>{label}</Text>
      </View>
    </TactileButton>
  );
}

export function IconButton({ icon, label, onPress, active = false }: { icon: string; label: string; onPress: () => void; active?: boolean }) {
  const { reduceMotion, appActive } = useMotionPreferences();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.iconButton,
        active && styles.iconButtonActive,
        pressed && (reduceMotion || !appActive ? styles.iconPressedReducedMotion : styles.iconPressed),
      ]}
    >
      <Text style={[styles.iconButtonText, active && styles.iconButtonTextActive]}>{icon}</Text>
    </Pressable>
  );
}

export function Pill({ label, tone = 'neutral' }: { label: string; tone?: PillTone }) {
  return (
    <View style={[styles.pill, tone === 'success' && styles.pillSuccess, tone === 'primary' && styles.pillPrimary, tone === 'warning' && styles.pillWarning]}>
      <Text style={[styles.pillText, tone === 'success' && styles.pillTextSuccess, tone === 'primary' && styles.pillTextPrimary, tone === 'warning' && styles.pillTextWarning]}>{label}</Text>
    </View>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? <Text style={styles.sectionAction}>{action}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    padding: theme.space.lg,
    ...shadows.card,
  },
  cardPrimary: { backgroundColor: theme.colors.primarySurface, borderColor: theme.colors.primaryBorder },
  cardSuccess: { backgroundColor: theme.colors.successSurface, borderColor: theme.colors.successBorder },
  glassCard: {
    backgroundColor: theme.colors.surfaceGlass,
    borderWidth: 1,
    borderColor: theme.colors.borderGlass,
    borderRadius: theme.radius.xl,
    padding: theme.space.md,
  },
  progressTrack: {
    height: 9,
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceGlassStrong,
  },
  progressValue: {
    height: '100%',
    backgroundColor: theme.colors.primaryBright,
    borderRadius: theme.radius.pill,
  },
  primaryButton: {
    minHeight: theme.control.heightLg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary,
    borderWidth: 1,
    borderColor: theme.colors.borderEmphasis,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
    ...shadows.primaryGlow,
  },
  primaryButtonText: {
    color: theme.colors.white,
    fontSize: theme.type.body,
    fontWeight: theme.weight.black,
    letterSpacing: 0.1,
  },
  primaryButtonIcon: { color: theme.colors.white, fontSize: theme.type.bodyLarge, fontWeight: theme.weight.black },
  secondaryButton: {
    minHeight: theme.control.heightMd,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderGlass,
    backgroundColor: theme.colors.surfaceGlass,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
    ...shadows.control,
  },
  secondaryButtonText: { color: theme.colors.text, fontSize: 13, fontWeight: theme.weight.bold },
  buttonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.space.sm },
  disabled: { opacity: 0.4 },
  iconButton: {
    width: theme.control.heightSm,
    height: theme.control.heightSm,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceGlass,
    borderWidth: 1,
    borderColor: theme.colors.borderControl,
  },
  iconButtonActive: { backgroundColor: theme.colors.primaryGlass, borderColor: theme.colors.primaryBorderStrong },
  iconPressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  iconPressedReducedMotion: { opacity: 0.72 },
  iconButtonText: { color: theme.colors.textSecondary, fontSize: 17, fontWeight: theme.weight.black },
  iconButtonTextActive: { color: theme.colors.primaryText },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceGlass,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.xs,
  },
  pillSuccess: { backgroundColor: theme.colors.successGlass, borderColor: theme.colors.successBorderStrong },
  pillPrimary: { backgroundColor: theme.colors.primaryGlass, borderColor: theme.colors.primaryBorder },
  pillWarning: { backgroundColor: theme.colors.warningGlass, borderColor: theme.colors.warningBorder },
  pillText: { color: theme.colors.textSecondary, fontSize: theme.type.caption, fontWeight: theme.weight.bold },
  pillTextSuccess: { color: theme.colors.success },
  pillTextPrimary: { color: theme.colors.primaryTextSoft },
  pillTextWarning: { color: theme.colors.warning },
  stat: {
    flex: 1,
    minHeight: 76,
    backgroundColor: theme.colors.surfaceStat,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    padding: theme.space.md,
  },
  statValue: { color: theme.colors.text, fontSize: 19, fontWeight: theme.weight.black },
  statLabel: { color: theme.colors.textSecondary, fontSize: theme.type.caption, marginTop: 3 },
  statHint: { color: theme.colors.textMuted, fontSize: 9.5, marginTop: theme.space.xxs },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.space.xl,
    marginBottom: theme.space.sm,
  },
  sectionTitle: { color: theme.colors.text, fontSize: theme.type.title, fontWeight: theme.weight.black },
  sectionAction: { color: theme.colors.primaryTextSoft, fontSize: 11.5, fontWeight: theme.weight.bold },
});
