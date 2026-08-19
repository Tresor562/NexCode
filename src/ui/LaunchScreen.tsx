import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export function LaunchScreen({ onDone }: { onDone: () => void }) {
  const nX = useRef(new Animated.Value(0)).current;
  const restOpacity = useRef(new Animated.Value(0)).current;
  const restX = useRef(new Animated.Value(18)).current;
  const robotScale = useRef(new Animated.Value(0.7)).current;
  const glow = useRef(new Animated.Value(0)).current;

  const glowOpacity = useMemo(() => glow.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.42] }), [glow]);

  useEffect(() => {
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
      ]),
      Animated.delay(260),
    ]);
    sequence.start(({ finished }) => { if (finished) onDone(); });
    return () => sequence.stop();
  }, [glow, nX, onDone, restOpacity, restX, robotScale]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Animated.View style={[styles.glow, { opacity: glowOpacity }]} />
      <View style={styles.wordmarkRow}>
        <Animated.Text style={[styles.n, { transform: [{ translateX: nX }] }]}>N</Animated.Text>
        <Animated.View style={[styles.rest, { opacity: restOpacity, transform: [{ translateX: restX }] }]}> 
          <Text style={styles.letters}>exC</Text>
          <Animated.View style={[styles.robot, { transform: [{ scale: robotScale }] }]}> 
            <View style={styles.robotEyeRow}><View style={styles.eye} /><View style={styles.eye} /></View>
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
  root: { flex: 1, backgroundColor: '#070B16', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  glow: { position: 'absolute', width: 330, height: 330, borderRadius: 165, backgroundColor: '#476CFF' },
  wordmarkRow: { height: 86, minWidth: 330, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  n: { position: 'absolute', color: '#EEF2FF', fontSize: 60, lineHeight: 70, fontWeight: '900', letterSpacing: -5, textShadowColor: '#5576FF', textShadowRadius: 18 },
  rest: { marginLeft: 45, flexDirection: 'row', alignItems: 'center' },
  letters: { color: '#EEF2FF', fontSize: 52, lineHeight: 62, fontWeight: '900', letterSpacing: -4 },
  robot: { width: 48, height: 44, borderRadius: 15, marginHorizontal: 3, backgroundColor: '#657BFF', borderWidth: 1, borderColor: '#A9B5FF', alignItems: 'center', justifyContent: 'center', shadowColor: '#7C4DFF', shadowOpacity: 0.8, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 10 },
  robotEyeRow: { flexDirection: 'row', gap: 9 },
  eye: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F8FAFF' },
  robotMouth: { width: 18, height: 3, borderRadius: 2, backgroundColor: '#DCE3FF', marginTop: 7 },
  tagline: { color: '#6F7892', fontSize: 11, fontWeight: '700', letterSpacing: 1.4, marginTop: 12 },
});
