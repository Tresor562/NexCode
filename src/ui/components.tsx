import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { shadows, theme } from './theme';

export function Card({
  children,
  style,
  tone = 'default',
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  tone?: 'default' | 'primary' | 'success';
}) {
  return (
    <View
      style={[
        styles.card,
        tone === 'primary' && styles.cardPrimary,
        tone === 'success' && styles.cardSuccess,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressValue, { width: `${safeValue}%` }]} />
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function Pill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'success' | 'primary' | 'warning';
}) {
  return (
    <View
      style={[
        styles.pill,
        tone === 'success' && styles.pillSuccess,
        tone === 'primary' && styles.pillPrimary,
        tone === 'warning' && styles.pillWarning,
      ]}
    >
      <Text
        style={[
          styles.pillText,
          tone === 'success' && styles.pillTextSuccess,
          tone === 'primary' && styles.pillTextPrimary,
          tone === 'warning' && styles.pillTextWarning,
        ]}
      >
        {label}
      </Text>
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
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.space.lg,
    ...shadows.card,
  },
  cardPrimary: {
    backgroundColor: '#111936',
    borderColor: '#34458A',
  },
  cardSuccess: {
    backgroundColor: theme.colors.successSoft,
    borderColor: '#235A40',
  },
  progressTrack: {
    height: 7,
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
    backgroundColor: '#202A40',
  },
  progressValue: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.pill,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.45 },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillSuccess: { backgroundColor: theme.colors.successSoft, borderColor: '#235A40' },
  pillPrimary: { backgroundColor: theme.colors.primarySoft, borderColor: '#39499A' },
  pillWarning: { backgroundColor: '#2B2413', borderColor: '#624F1D' },
  pillText: { color: theme.colors.textSecondary, fontSize: 11, fontWeight: '700' },
  pillTextSuccess: { color: theme.colors.success },
  pillTextPrimary: { color: '#AAB4FF' },
  pillTextWarning: { color: theme.colors.warning },
  stat: {
    flex: 1,
    minHeight: 86,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.space.md,
  },
  statValue: { color: theme.colors.text, fontSize: 19, fontWeight: '900' },
  statLabel: { color: theme.colors.textSecondary, fontSize: 11, marginTop: 4 },
  statHint: { color: theme.colors.textMuted, fontSize: 10, marginTop: 5 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.space.xl,
    marginBottom: theme.space.sm,
  },
  sectionTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '800' },
  sectionAction: { color: '#98A4FF', fontSize: 12, fontWeight: '700' },
});
