import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
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
  const disabled = state === 'locked';
  const translateY = press.interpolate({ inputRange: [0, 1], outputRange: [0, 5] });

  const animate = (toValue: number) => {
    Animated.spring(press, {
      toValue,
      useNativeDriver: true,
      speed: 34,
      bounciness: 0,
    }).start();
  };

  return (
    <View style={[styles.row, { transform: [{ translateX: offset }] }]}>
      {showConnector ? <View style={[styles.connector, state === 'done' && styles.connectorDone]} /> : null}
      <View style={styles.nodeStack}>
        <View style={[styles.nodeBase, state === 'current' && styles.nodeBaseCurrent, state === 'done' && styles.nodeBaseDone, disabled && styles.nodeBaseLocked]} />
        <Animated.View style={{ transform: [{ translateY }] }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={title}
            accessibilityState={{ disabled, selected: state === 'current' }}
            disabled={disabled}
            onPress={onPress}
            onPressIn={() => animate(1)}
            onPressOut={() => animate(0)}
            style={[
              styles.node,
              state === 'current' && styles.nodeCurrent,
              state === 'done' && styles.nodeDone,
              disabled && styles.nodeLocked,
            ]}
          >
            <Text style={[styles.icon, state === 'done' && styles.iconDone, disabled && styles.iconLocked]}>{state === 'done' ? '✓' : icon}</Text>
          </Pressable>
        </Animated.View>
      </View>

      <View style={styles.copy}>
        <View style={styles.badgeRow}>
          {state === 'current' ? <Pill label="À faire" tone="primary" /> : null}
          {state === 'done' ? <Pill label="Terminé" tone="success" /> : null}
        </View>
        <Text style={[styles.title, disabled && styles.titleLocked]} numberOfLines={2}>{title}</Text>
        {!disabled && meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 122,
    maxWidth: '82%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    position: 'relative',
  },
  connector: {
    position: 'absolute',
    left: 31,
    top: 68,
    width: 4,
    height: 62,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,.07)',
  },
  connectorDone: { backgroundColor: 'rgba(91,227,154,.28)' },
  nodeStack: { width: 68, height: 72, position: 'relative' },
  nodeBase: {
    position: 'absolute',
    left: 2,
    right: 2,
    bottom: 0,
    height: 62,
    borderRadius: 23,
    backgroundColor: '#2B3260',
  },
  nodeBaseCurrent: { backgroundColor: '#4450B9' },
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
    borderColor: '#C4CBFF',
    shadowOpacity: .42,
    elevation: 8,
  },
  nodeDone: {
    backgroundColor: '#23714F',
    borderColor: 'rgba(125,241,181,.55)',
    shadowColor: theme.colors.success,
    shadowOpacity: .18,
  },
  nodeLocked: {
    backgroundColor: 'rgba(255,255,255,.035)',
    borderColor: 'rgba(255,255,255,.08)',
    shadowOpacity: 0,
    elevation: 0,
  },
  icon: { color: '#D5DAFF', fontSize: 18, fontWeight: '900' },
  iconDone: { color: '#D9FFEA' },
  iconLocked: { color: 'rgba(255,255,255,.18)' },
  copy: { flex: 1, paddingLeft: 13, paddingTop: 2 },
  badgeRow: { minHeight: 26, flexDirection: 'row', alignItems: 'center' },
  title: { color: theme.colors.text, fontSize: 14, fontWeight: '900', lineHeight: 19, marginTop: 5 },
  titleLocked: { color: 'rgba(255,255,255,.25)' },
  meta: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '700', marginTop: 5 },
});
