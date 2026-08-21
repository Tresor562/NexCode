import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
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
  const disabled = state === 'locked';
  const isCurrent = state === 'current';
  const translateY = press.interpolate({ inputRange: [0, 1], outputRange: [0, 5] });
  const ringScale = focusPulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.18] });
  const ringOpacity = focusPulse.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0.18, 0.34, 0] });

  useEffect(() => {
    if (!isCurrent) {
      focusPulse.stopAnimation();
      focusPulse.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(focusPulse, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(focusPulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [focusPulse, isCurrent]);

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
              { opacity: ringOpacity, transform: [{ scale: ringScale }] },
            ]}
          />
        ) : null}

        <View style={[styles.nodeBase, isCurrent && styles.nodeBaseCurrent, state === 'done' && styles.nodeBaseDone, disabled && styles.nodeBaseLocked]} />
        <Animated.View style={{ transform: [{ translateY }] }}>
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
            <Text style={[styles.icon, state === 'done' && styles.iconDone, disabled && styles.iconLocked]}>{state === 'done' ? '✓' : icon}</Text>
            {isCurrent ? <View style={styles.currentDot} /> : null}
          </Pressable>
        </Animated.View>
      </View>

      <View style={styles.copy}>
        <View style={styles.badgeRow}>
          {isCurrent ? <Pill label="CONTINUER" tone="primary" /> : null}
          {state === 'done' ? <Pill label="MAÎTRISÉ" tone="success" /> : null}
          {state === 'available' ? <Text style={styles.availableLabel}>DISPONIBLE</Text> : null}
          {disabled ? <Text style={styles.lockedLabel}>VERROUILLÉ</Text> : null}
        </View>
        <Text style={[styles.title, isCurrent && styles.titleCurrent, disabled && styles.titleLocked]} numberOfLines={2}>{title}</Text>
        {!disabled && meta ? <Text style={styles.meta}>{meta}</Text> : null}
        {disabled ? <Text style={styles.lockedMeta}>Progresse sur le chemin pour débloquer cette étape.</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 124,
    maxWidth: '86%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    position: 'relative',
  },
  connectorTrack: {
    position: 'absolute',
    left: 31,
    top: 68,
    width: 4,
    height: 64,
    borderRadius: 99,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,.07)',
  },
  connectorTrackDone: { backgroundColor: 'rgba(91,227,154,.26)' },
  connectorGlow: {
    width: '100%',
    height: '72%',
    borderRadius: 99,
    backgroundColor: 'rgba(137,255,198,.44)',
  },
  nodeStack: { width: 68, height: 74, position: 'relative', alignItems: 'center' },
  focusRing: {
    position: 'absolute',
    top: -3,
    width: 70,
    height: 70,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: '#AEB8FF',
    backgroundColor: 'rgba(110,123,255,.12)',
  },
  nodeBase: {
    position: 'absolute',
    left: 2,
    right: 2,
    bottom: 0,
    height: 62,
    borderRadius: 23,
    backgroundColor: '#2B3260',
  },
  nodeBaseCurrent: { backgroundColor: '#414DB7' },
  nodeBaseDone: { backgroundColor: '#1E6948' },
  nodeBaseLocked: { backgroundColor: 'rgba(255,255,255,.045)' },
  node: {
    width: 64,
    height: 64,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#30396F',
    borderWidth: 2,
    borderColor: 'rgba(180,189,255,.28)',
    shadowColor: '#6978FF',
    shadowOpacity: .16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  nodeCurrent: {
    backgroundColor: theme.colors.primary,
    borderColor: '#D3D8FF',
    shadowOpacity: .5,
    shadowRadius: 18,
    elevation: 10,
  },
  nodeDone: {
    backgroundColor: '#23714F',
    borderColor: 'rgba(125,241,181,.58)',
    shadowColor: theme.colors.success,
    shadowOpacity: .18,
  },
  nodeAvailable: {
    borderColor: 'rgba(190,198,255,.38)',
    backgroundColor: '#343E79',
  },
  nodeLocked: {
    backgroundColor: 'rgba(255,255,255,.035)',
    borderColor: 'rgba(255,255,255,.08)',
    shadowOpacity: 0,
    elevation: 0,
  },
  icon: { color: '#E0E4FF', fontSize: 18, fontWeight: '900' },
  iconDone: { color: '#D9FFEA' },
  iconLocked: { color: 'rgba(255,255,255,.18)' },
  currentDot: {
    position: 'absolute',
    bottom: 7,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    opacity: .86,
  },
  copy: { flex: 1, paddingLeft: 13, paddingTop: 1 },
  badgeRow: { minHeight: 27, flexDirection: 'row', alignItems: 'center' },
  availableLabel: { color: '#AEB7FF', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  lockedLabel: { color: 'rgba(255,255,255,.25)', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: theme.colors.text, fontSize: 14, fontWeight: '900', lineHeight: 19, marginTop: 5 },
  titleCurrent: { fontSize: 15, color: '#FFFFFF' },
  titleLocked: { color: 'rgba(255,255,255,.25)' },
  meta: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '700', marginTop: 5, lineHeight: 14 },
  lockedMeta: { color: 'rgba(255,255,255,.18)', fontSize: 9, fontWeight: '700', marginTop: 5, lineHeight: 13 },
});
