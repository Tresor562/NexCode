import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { shadows, theme } from './theme';

export function Card({ children, style, tone = 'default' }: { children: React.ReactNode; style?: ViewStyle | ViewStyle[]; tone?: 'default' | 'primary' | 'success' }) {
  return <View style={[styles.card, tone === 'primary' && styles.cardPrimary, tone === 'success' && styles.cardSuccess, style]}>{children}</View>;
}

export function GlassCard({ children, style }: { children: React.ReactNode; style?: ViewStyle | ViewStyle[] }) {
  return <View style={[styles.glassCard, style]}>{children}</View>;
}

export function ProgressBar({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(100, value));
  return <View style={styles.progressTrack}><View style={[styles.progressValue, { width: `${safeValue}%` }]} /></View>;
}

function TactileButton({ children, onPress, disabled, style }: { children: React.ReactNode; onPress: () => void; disabled?: boolean; style: ViewStyle }) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (toValue: number) => Animated.spring(scale, { toValue, useNativeDriver: true, speed: 28, bounciness: 5 }).start();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} onPressIn={() => animate(.975)} onPressOut={() => animate(1)} style={[style, disabled && styles.disabled]}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

export function PrimaryButton({ label, onPress, disabled = false, icon }: { label: string; onPress: () => void; disabled?: boolean; icon?: string }) {
  return <TactileButton onPress={onPress} disabled={disabled} style={styles.primaryButton}><View style={styles.buttonRow}>{icon ? <Text style={styles.primaryButtonIcon}>{icon}</Text> : null}<Text style={styles.primaryButtonText}>{label}</Text></View></TactileButton>;
}

export function SecondaryButton({ label, onPress, icon }: { label: string; onPress: () => void; icon?: string }) {
  return <TactileButton onPress={onPress} style={styles.secondaryButton}><View style={styles.buttonRow}>{icon ? <Text style={styles.secondaryButtonText}>{icon}</Text> : null}<Text style={styles.secondaryButtonText}>{label}</Text></View></TactileButton>;
}

export function IconButton({ icon, label, onPress, active = false }: { icon: string; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.iconButton, active && styles.iconButtonActive, pressed && styles.iconPressed]}>
      <Text style={[styles.iconButtonText, active && styles.iconButtonTextActive]}>{icon}</Text>
    </Pressable>
  );
}

export function Pill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'primary' | 'warning' }) {
  return <View style={[styles.pill, tone === 'success' && styles.pillSuccess, tone === 'primary' && styles.pillPrimary, tone === 'warning' && styles.pillWarning]}><Text style={[styles.pillText, tone === 'success' && styles.pillTextSuccess, tone === 'primary' && styles.pillTextPrimary, tone === 'warning' && styles.pillTextWarning]}>{label}</Text></View>;
}

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text>{hint ? <Text style={styles.statHint}>{hint}</Text> : null}</View>;
}

export function SectionHeader({ title, action }: { title: string; action?: string }) {
  return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text>{action ? <Text style={styles.sectionAction}>{action}</Text> : null}</View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: 'rgba(17,23,39,.92)', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,.07)', padding: 16, ...shadows.card },
  cardPrimary: { backgroundColor: 'rgba(50,63,133,.30)', borderColor: 'rgba(132,148,255,.28)' },
  cardSuccess: { backgroundColor: 'rgba(31,101,68,.22)', borderColor: 'rgba(79,210,139,.24)' },
  glassCard: { backgroundColor: 'rgba(255,255,255,.055)', borderWidth: 1, borderColor: 'rgba(255,255,255,.10)', borderRadius: 20, padding: 14 },
  progressTrack: { height: 8, borderRadius: 999, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,.08)' },
  progressValue: { height: '100%', backgroundColor: theme.colors.primary, borderRadius: 999 },
  primaryButton: { minHeight: 52, borderRadius: 17, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, shadowColor: theme.colors.primary, shadowOpacity: .28, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: .1 },
  primaryButtonIcon: { color: '#fff', fontSize: 16, fontWeight: '900' },
  secondaryButton: { minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,.11)', backgroundColor: 'rgba(255,255,255,.055)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  secondaryButtonText: { color: theme.colors.text, fontSize: 13, fontWeight: '800' },
  buttonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  disabled: { opacity: .4 },
  iconButton: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.055)', borderWidth: 1, borderColor: 'rgba(255,255,255,.09)' },
  iconButtonActive: { backgroundColor: 'rgba(105,119,255,.18)', borderColor: 'rgba(135,149,255,.35)' },
  iconPressed: { opacity: .72, transform: [{ scale: .96 }] },
  iconButtonText: { color: theme.colors.textSecondary, fontSize: 17, fontWeight: '900' },
  iconButtonTextActive: { color: '#B7C0FF' },
  pill: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: 'rgba(255,255,255,.055)', borderWidth: 1, borderColor: 'rgba(255,255,255,.08)', paddingHorizontal: 10, paddingVertical: 6 },
  pillSuccess: { backgroundColor: 'rgba(61,190,117,.12)', borderColor: 'rgba(61,190,117,.25)' },
  pillPrimary: { backgroundColor: 'rgba(107,122,255,.14)', borderColor: 'rgba(107,122,255,.28)' },
  pillWarning: { backgroundColor: 'rgba(232,180,64,.12)', borderColor: 'rgba(232,180,64,.24)' },
  pillText: { color: theme.colors.textSecondary, fontSize: 10.5, fontWeight: '800' },
  pillTextSuccess: { color: theme.colors.success }, pillTextPrimary: { color: '#B4BDFF' }, pillTextWarning: { color: theme.colors.warning },
  stat: { flex: 1, minHeight: 76, backgroundColor: 'rgba(255,255,255,.045)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,.075)', padding: 12 },
  statValue: { color: theme.colors.text, fontSize: 19, fontWeight: '900' }, statLabel: { color: theme.colors.textSecondary, fontSize: 10.5, marginTop: 3 }, statHint: { color: theme.colors.textMuted, fontSize: 9.5, marginTop: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 10 },
  sectionTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '900' }, sectionAction: { color: '#A4AEFF', fontSize: 11.5, fontWeight: '800' },
});