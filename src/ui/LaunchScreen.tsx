import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { theme } from './theme';
import { useMotionPreferences } from './motionPreferences';

export function LaunchScreen({ onDone }: { onDone: () => void }) {
  const nX = useRef(new Animated.Value(0)).current;
  const restOpacity = useRef(new Animated.Value(0)).current;
  const restX = useRef(new Animated.Value(18)).current;
  const robotScale = useRef(new Animated.Value(0.7)).current;
  const robotBlink = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const completed = useRef(false);
  const onDoneRef = useRef(onDone);
  const completionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { reduceMotion, appActive } = useMotionPreferences();
  const { width } = useWindowDimensions();
  const wordmarkScale = Math.min(1, Math.max(0.78, (width - theme.space.xxl) / 330));

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const glowOpacity = useMemo(() => glow.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.42] }), [glow]);

  useEffect(() => {
    const stopAnimations = () => {
      nX.stopAnimation();
      restOpacity.stopAnimation();
      restX.stopAnimation();
      robotScale.stopAnimation();
      robotBlink.stopAnimation();
      glow.stopAnimation();
    };

    const clearCompletionTimer = () => {
      if (completionTimer.current) {
        clearTimeout(completionTimer.current);
        completionTimer.current = null;
      }
    };

    const finish = () => {
      if (completed.current) return;
      completed.current = true;
      onDoneRef.current();
    };

    stopAnimations();
    clearCompletionTimer();

    if (!appActive) {
      return () => {
        clearCompletionTimer();
        stopAnimations();
      };
    }

    if (reduceMotion) {
      nX.setValue(-76);
      restOpacity.setValue(1);
      restX.setValue(0);
      robotScale.setValue(1);
      robotBlink.setValue(1);
      glow.setValue(0.35);
      completionTimer.current = setTimeout(finish, 180);
      return () => {
        clearCompletionTimer();
        stopAnimations();
      };
    }

    nX.setValue(0);
    restOpacity.setValue(0);
    restX.setValue(18);
    robotScale.setValue(0.7);
    robotBlink.setValue(1);
    glow.setValue(0);

    const blinkSequence = Animated.sequence([
      Animated.delay(90),
      Animated.timing(robotBlink, { toValue: 0.18, duration: 60, useNativeDriver: true }),
      Animated.timing(robotBlink, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.delay(70),
      Animated.timing(robotBlink, { toValue: 0.18, duration: 60, useNativeDriver: true }),
      Animated.timing(robotBlink, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]);

    const sequence = Animated.sequence([
      Animated.delay(180),
      Animated.parallel([
        Animated.timing(nX, { toValue: -76, duration: 430, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(restOpacity, { toValue: 1, duration: 360, useNativeDriver: true }),
        Animated.timing(restX, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(robotScale, { toValue: 1, speed: 16, bounciness: 8, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 220, useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0.35, duration: 280, useNativeDriver: true }),
        ]),
        blinkSequence,
      ]),
      Animated.delay(260),
    ]);

    sequence.start(({ finished }) => {
      if (finished) finish();
    });

    return () => {
      sequence.stop();
      clearCompletionTimer();
      stopAnimations();
    };
  }, [appActive, glow, nX, reduceMotion, restOpacity, restX, robotBlink, robotScale]);

  return (
    <View style={styles.root} accessibilityViewIsModal>
      <StatusBar style="light" />
      <Animated.View pointerEvents="none" style={[styles.glow, { opacity: glowOpacity }]} />
      <View
        style={[styles.wordmarkRow, { transform: [{ scale: wordmarkScale }] }]}
        accessible
        accessibilityRole="header"
        accessibilityLabel="NexCode"
      >
        <Animated.Text style={[styles.n, { transform: [{ translateX: nX }] }]}>N</Animated.Text>
        <Animated.View style={[styles.rest, { opacity: restOpacity, transform: [{ translateX: restX }] }]}>
          <Text style={styles.letters}>exC</Text>
          <Animated.View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={[styles.robot, { transform: [{ scale: robotScale }] }]}>
            <Animated.View style={[styles.robotEyeRow, { opacity: robotBlink }]}><View style={styles.eye} /><View style={styles.eye} /></Animated.View>
            <View style={styles.robotMouth} />
          </Animated.View>
          <Text style={styles.letters}>de</Text>
        </Animated.View>
      </View>
      <Text style={styles.tagline}>Learn • Practice • Build • Master</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  glow: { position: 'absolute', width: 330, height: 330, borderRadius: 165, backgroundColor: theme.colors.primary },
  wordmarkRow: { height: 86, width: 330, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  n: { position: 'absolute', color: theme.colors.text, fontSize: 60, lineHeight: 70, fontWeight: theme.weight.black, letterSpacing: -5, textShadowColor: theme.colors.primary, textShadowRadius: 18 },
  rest: { marginLeft: 45, flexDirection: 'row', alignItems: 'center' },
  letters: { color: theme.colors.text, fontSize: 52, lineHeight: 62, fontWeight: theme.weight.black, letterSpacing: -4 },
  robot: { width: 48, height: 44, borderRadius: 15, marginHorizontal: 3, backgroundColor: theme.colors.primary, borderWidth: 1, borderColor: theme.colors.primaryBright, alignItems: 'center', justifyContent: 'center', shadowColor: theme.colors.purple, shadowOpacity: 0.8, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 10 },
  robotEyeRow: { flexDirection: 'row', gap: 9 },
  eye: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.text },
  robotMouth: { width: 18, height: 3, borderRadius: 2, backgroundColor: theme.colors.textSecondary, marginTop: 7 },
  tagline: { color: theme.colors.textMuted, fontSize: theme.type.caption, fontWeight: theme.weight.semibold, letterSpacing: 1.4, marginTop: 12 },
});