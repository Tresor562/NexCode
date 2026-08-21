import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Pill } from './components';
import { theme } from './theme';

export type LearningPathNodeState = 'done' | 'current' | 'available' | 'locked';

export function LearningPathNode({
  title,
  meta,
  icon,
  state,
  offset = 0,
  showConnector = true,
  onPress,
}: {
  title: string;
  meta?: string;
  icon: string;
  state: LearningPathNodeState;
  offset?: number;
  showConnector?: boolean;
  onPress: () => void;
}) {
  const press = useRef(new Animated.Value(0)).current;
  const focusPulse = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const disabled = state === 'locked';
  const isCurrent = state === 'current';
  const translateY = press.interpolate({ inputRange: [0, 1], outputRange: [0, 4] });
  const nodeScale = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.965] });
  const ringScale = focusPulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.2] });
  const ringOpacity = focusPulse.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0.16, 0.34, 0] });
  const shimmerX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-54, 70] });

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!isCurrent || reduceMotion) {
      focusPulse.stopAnimation();
      shimmer.stopAnimation();
      focusPulse.setValue(0);
      shimmer.setValue(0);
      return;
    }

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(focusPulse, {
          toValue: 1,
          duration: 1500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(focusPulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(380),
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 920,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(1100),
      ]),
    );

    pulseLoop.start();
    shimmerLoop.start();
    return () => {
      pulseLoop.stop();
      shimmerLoop.stop();
    };
  }, [focusPulse, isCurrent, reduceMotion, shimmer]);

  const animate = (toValue: number) => {
    Animated.spring(press, {
      toValue,
      useNativeDriver: true,
      speed: 34,
      bounciness: 0,
    }).start();
  };

  const handlePress = () => {
    Haptics.selectionAsync().catch(() => undefined);
    onPress();
  };

  const accessibilityHint = disabled
    ? 'Termine les étapes précédentes pour débloquer cette activité.'
    : isCurrent
      ? 'C’est ta prochaine activité recommandée.'
      : state === 'done'
        ? 'Activité terminée. Tu peux la refaire pour réviser.'
        : 'Ouvre cette activité.';

  return (
    <View style={[styles.row, { transform: [{ translateX: offset }] }]}>
      {showConnector ? (
        <View style={[styles.connectorTrack, state === 'done' && styles.connectorTrackDone]}>
          {state === 'done' ? <View style={styles.connectorGlow} /> : null}
        </View>
      ) : null}

      <View style={styles.nodeStack}>
        {isCurrent ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.focusRing,
              reduceMotion ? styles.focusRingReduced : { opacity: ringOpacity, transform: [{ scale: ringScale }] },
            ]}
          />
        ) : null}

        <View style={[styles.nodeBase, isCurrent && styles.nodeBaseCurrent, state === 'done' && styles.nodeBaseDone, disabled && styles.nodeBaseLocked]} />
        <Animated.View style={{ transform: [{ translateY }, { scale: nodeScale }] }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={title}
            accessibilityHint={accessibilityHint}
            accessibilityState={{ disabled, selected: isCurrent }}
            disabled={disabled}
            onPress={handlePress}
            onPressIn={() => animate(1)}
            onPressOut={() => animate(0)}
            style={[
              styles.node,
              isCurrent && styles.nodeCurrent,
              state === 'done' && styles.nodeDone,
              state === 'available' && styles.nodeAvailable,
              disabled && styles.nodeLocked,
            ]}
          >
            {isCurrent ? (
              <Animated.View
                pointerEvents="none"
                style={[styles.shimmer, { transform: [{ translateX: shimmerX }, { rotate: '18deg' }] }]}
              />
            ) : null}
            <View style={[styles.iconWell, isCurrent && styles.iconWellCurrent, state === 'done' && styles.iconWellDone, disabled && styles.iconWellLocked]}>
              <Text style={[styles.icon, state === 'done' && styles.iconDone, disabled && styles.iconLocked]}>{state === 'done' ? '✓' : icon}</Text>
            </View>
            {isCurrent ? <View style={styles.currentDot} /> : null}
          </Pressable>
        </Animated.View>
      </View>

      <View style={styles.copy}>
        <View style={styles.badgeRow}>
          {isCurrent ? <Pill label="À CONTINUER" tone="primary" /> : null}
          {state === 'done' ? <Pill label="TERMINÉ" tone="success" /> : null}
          {state === 'available' ? <Text style={styles.availableLabel}>DISPONIBLE</Text> : null}
          {disabled ? <Text style={styles.lockedLabel}>VERROUILLÉ</Text> : null}
        </View>
        <Text style={[styles.title, isCurrent && styles.titleCurrent, disabled && styles.titleLocked]} numberOfLines={2}>{title}</Text>
        {!disabled && meta ? <Text style={[styles.meta, isCurrent && styles.metaCurrent]}>{meta}</Text> : null}
        {disabled ? <Text style={styles.lockedMeta}>Termine l’étape précédente pour avancer.</Text> : null}
        {isCurrent ? (
          <View style={styles.nextCue}>
            <View style={styles.nextCueDot} />
            <Text style={styles.nextCueText}>PROCHAINE ÉTAPE RECOMMANDÉE</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 132,
    width: '86%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    position: 'relative',
    paddingRight: 4,
  },
  connectorTrack: {
    position: 'absolute',
    left: 33,
    top: 70,
    width: 4,
    height: 70,
    borderRadius: 99,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,.07)',
  },
  connectorTrackDone: { backgroundColor: 'rgba(91,227,154,.24)' },
  connectorGlow: {
    width: '100%',
    height: '76%',
    borderRadius: 99,
    backgroundColor: 'rgba(137,255,198,.46)',
  },
  nodeStack: { width: 70, height: 78, position: 'relative', alignItems: 'center' },
  focusRing: {
    position: 'absolute',
    top: -4,
    width: 74,
    height: 74,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: '#AEB8FF',
    backgroundColor: 'rgba(110,123,255,.11)',
  },
  focusRingReduced: {
    opacity: .26,
    transform: [{ scale: 1.05 }],
  },
  nodeBase: {
    position: 'absolute',
    left: 2,
    right: 2,
    bottom: 0,
    height: 62,
    borderRadius: 24,
    backgroundColor: '#2A315D',
  },
  nodeBaseCurrent: { backgroundColor: '#3C47A3' },
  nodeBaseDone: { backgroundColor: '#1B6143' },
  nodeBaseLocked: { backgroundColor: 'rgba(255,255,255,.04)' },
  node: {
    width: 66,
    height: 66,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#30396F',
    borderWidth: 1.5,
    borderColor: 'rgba(180,189,255,.30)',
    shadowColor: '#6978FF',
    shadowOpacity: .16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  nodeCurrent: {
    backgroundColor: theme.colors.primary,
    borderColor: '#D7DCFF',
    shadowOpacity: .46,
    shadowRadius: 19,
    elevation: 10,
  },
  nodeDone: {
    backgroundColor: '#21704E',
    borderColor: 'rgba(125,241,181,.56)',
    shadowColor: theme.colors.success,
    shadowOpacity: .18,
  },
  nodeAvailable: {
    borderColor: 'rgba(190,198,255,.38)',
    backgroundColor: '#343E79',
  },
  nodeLocked: {
    backgroundColor: 'rgba(255,255,255,.03)',
    borderColor: 'rgba(255,255,255,.08)',
    shadowOpacity: 0,
    elevation: 0,
  },
  shimmer: {
    position: 'absolute',
    top: -10,
    bottom: -10,
    width: 18,
    backgroundColor: 'rgba(255,255,255,.15)',
  },
  iconWell: {
    width: 39,
    height: 39,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.08)',
  },
  iconWellCurrent: {
    backgroundColor: 'rgba(255,255,255,.13)',
    borderColor: 'rgba(255,255,255,.18)',
  },
  iconWellDone: {
    backgroundColor: 'rgba(217,255,234,.09)',
    borderColor: 'rgba(217,255,234,.16)',
  },
  iconWellLocked: {
    backgroundColor: 'rgba(255,255,255,.02)',
    borderColor: 'rgba(255,255,255,.04)',
  },
  icon: { color: '#E0E4FF', fontSize: 17, fontWeight: '900' },
  iconDone: { color: '#D9FFEA' },
  iconLocked: { color: 'rgba(255,255,255,.18)' },
  currentDot: {
    position: 'absolute',
    bottom: 6,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    opacity: .9,
  },
  copy: { flex: 1, paddingLeft: 14, paddingTop: 1, minWidth: 0 },
  badgeRow: { minHeight: 27, flexDirection: 'row', alignItems: 'center' },
  availableLabel: { color: '#AEB7FF', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  lockedLabel: { color: 'rgba(255,255,255,.25)', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: theme.colors.text, fontSize: 14, fontWeight: '900', lineHeight: 19, marginTop: 5 },
  titleCurrent: { fontSize: 15, color: '#FFFFFF', letterSpacing: -.1 },
  titleLocked: { color: 'rgba(255,255,255,.25)' },
  meta: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '700', marginTop: 5, lineHeight: 14 },
  metaCurrent: { color: '#B9C0E8' },
  lockedMeta: { color: 'rgba(255,255,255,.18)', fontSize: 9, fontWeight: '700', marginTop: 5, lineHeight: 13 },
  nextCue: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 9 },
  nextCueDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#7E8CFF' },
  nextCueText: { color: '#7E8CFF', fontSize: 8, fontWeight: '900', letterSpacing: .75 },
});