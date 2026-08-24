import React, { memo, useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useMotionPreferences } from './motionPreferences';
import { theme } from './theme';

export type NavGlyphName = 'home' | 'learn' | 'lab' | 'projects' | 'profile';

function GlyphBox({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <Animated.View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.box, style]}
    >
      {children}
    </Animated.View>
  );
}

export const NavGlyph = memo(function NavGlyph({ name, active }: { name: NavGlyphName; active: boolean }) {
  const { reduceMotion, appActive } = useMotionPreferences();
  const emphasis = useRef(new Animated.Value(active ? 1 : 0)).current;
  const colorStyle = active ? styles.active : styles.inactive;

  useEffect(() => {
    emphasis.stopAnimation();
    const target = active ? 1 : 0;
    if (reduceMotion || !appActive) {
      emphasis.setValue(target);
      return;
    }
    Animated.spring(emphasis, {
      toValue: target,
      damping: 18,
      stiffness: 230,
      mass: 0.65,
      useNativeDriver: true,
    }).start();
    return () => emphasis.stopAnimation();
  }, [active, appActive, emphasis, reduceMotion]);

  const motionStyle = {
    opacity: emphasis.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }),
    transform: [{ scale: emphasis.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
  };

  if (name === 'home') {
    return (
      <GlyphBox style={motionStyle}>
        <View style={[styles.roofLeft, colorStyle]} />
        <View style={[styles.roofRight, colorStyle]} />
        <View style={[styles.homeBody, colorStyle]} />
        <View style={[styles.homeDoor, active ? styles.doorActive : styles.doorInactive]} />
      </GlyphBox>
    );
  }

  if (name === 'learn') {
    return (
      <GlyphBox style={motionStyle}>
        <View style={[styles.bookLeft, colorStyle]} />
        <View style={[styles.bookRight, colorStyle]} />
        <View style={[styles.bookSpine, active ? styles.spineActive : styles.spineInactive]} />
      </GlyphBox>
    );
  }

  if (name === 'lab') {
    return (
      <GlyphBox style={motionStyle}>
        <View style={[styles.chevLeftA, colorStyle]} />
        <View style={[styles.chevLeftB, colorStyle]} />
        <View style={[styles.chevRightA, colorStyle]} />
        <View style={[styles.chevRightB, colorStyle]} />
        <View style={[styles.codeSlash, colorStyle]} />
      </GlyphBox>
    );
  }

  if (name === 'projects') {
    return (
      <GlyphBox style={motionStyle}>
        <View style={[styles.folderBack, colorStyle]} />
        <View style={[styles.folderTab, colorStyle]} />
        <View style={[styles.folderFront, colorStyle]} />
      </GlyphBox>
    );
  }

  return (
    <GlyphBox style={motionStyle}>
      <View style={[styles.head, colorStyle]} />
      <View style={[styles.shoulders, colorStyle]} />
    </GlyphBox>
  );
});

const styles = StyleSheet.create({
  box: { width: 28, height: 28, position: 'relative' },
  active: { borderColor: theme.colors.primaryBright, backgroundColor: theme.colors.primaryBright },
  inactive: { borderColor: theme.colors.textMuted, backgroundColor: theme.colors.textMuted },
  roofLeft: { position: 'absolute', width: 14, height: 3, borderRadius: 2, transform: [{ rotate: '-40deg' }], left: 2, top: 7 },
  roofRight: { position: 'absolute', width: 14, height: 3, borderRadius: 2, transform: [{ rotate: '40deg' }], right: 2, top: 7 },
  homeBody: { position: 'absolute', left: 6, right: 6, bottom: 4, height: 13, borderRadius: 3 },
  homeDoor: { position: 'absolute', width: 5, height: 8, bottom: 4, left: 12, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  doorActive: { backgroundColor: theme.colors.surfaceRaised },
  doorInactive: { backgroundColor: theme.colors.code },
  bookLeft: { position: 'absolute', left: 3, top: 5, width: 10, height: 18, borderRadius: 3, borderWidth: 2, backgroundColor: 'transparent' },
  bookRight: { position: 'absolute', right: 3, top: 5, width: 10, height: 18, borderRadius: 3, borderWidth: 2, backgroundColor: 'transparent' },
  bookSpine: { position: 'absolute', left: 13, top: 6, width: 2, height: 16 },
  spineActive: { backgroundColor: theme.colors.primaryBright },
  spineInactive: { backgroundColor: theme.colors.textMuted },
  chevLeftA: { position: 'absolute', left: 3, top: 8, width: 10, height: 3, borderRadius: 2, transform: [{ rotate: '-38deg' }] },
  chevLeftB: { position: 'absolute', left: 3, top: 16, width: 10, height: 3, borderRadius: 2, transform: [{ rotate: '38deg' }] },
  chevRightA: { position: 'absolute', right: 3, top: 8, width: 10, height: 3, borderRadius: 2, transform: [{ rotate: '38deg' }] },
  chevRightB: { position: 'absolute', right: 3, top: 16, width: 10, height: 3, borderRadius: 2, transform: [{ rotate: '-38deg' }] },
  codeSlash: { position: 'absolute', left: 12, top: 5, width: 3, height: 19, borderRadius: 2, transform: [{ rotate: '15deg' }] },
  folderBack: { position: 'absolute', left: 3, right: 3, bottom: 4, height: 17, borderRadius: 4 },
  folderTab: { position: 'absolute', left: 5, top: 4, width: 10, height: 6, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  folderFront: { position: 'absolute', left: 3, right: 3, bottom: 4, height: 12, borderRadius: 4, borderWidth: 2, backgroundColor: 'transparent' },
  head: { position: 'absolute', top: 3, left: 9, width: 10, height: 10, borderRadius: 5 },
  shoulders: { position: 'absolute', left: 4, right: 4, bottom: 3, height: 11, borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomLeftRadius: 5, borderBottomRightRadius: 5 },
});
