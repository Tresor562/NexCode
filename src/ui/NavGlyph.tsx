import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

export type NavGlyphName = 'home' | 'learn' | 'lab' | 'projects' | 'profile';

function GlyphBox({ children }: { children: React.ReactNode }) {
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.box}
    >
      {children}
    </View>
  );
}

export const NavGlyph = memo(function NavGlyph({ name, active }: { name: NavGlyphName; active: boolean }) {
  const colorStyle = active ? styles.active : styles.inactive;

  if (name === 'home') {
    return (
      <GlyphBox>
        <View style={[styles.roofLeft, colorStyle]} />
        <View style={[styles.roofRight, colorStyle]} />
        <View style={[styles.homeBody, colorStyle]} />
        <View style={[styles.homeDoor, active ? styles.doorActive : styles.doorInactive]} />
      </GlyphBox>
    );
  }

  if (name === 'learn') {
    return (
      <GlyphBox>
        <View style={[styles.bookLeft, colorStyle]} />
        <View style={[styles.bookRight, colorStyle]} />
        <View style={[styles.bookSpine, active ? styles.spineActive : styles.spineInactive]} />
      </GlyphBox>
    );
  }

  if (name === 'lab') {
    return (
      <GlyphBox>
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
      <GlyphBox>
        <View style={[styles.folderBack, colorStyle]} />
        <View style={[styles.folderTab, colorStyle]} />
        <View style={[styles.folderFront, colorStyle]} />
      </GlyphBox>
    );
  }

  return (
    <GlyphBox>
      <View style={[styles.head, colorStyle]} />
      <View style={[styles.shoulders, colorStyle]} />
    </GlyphBox>
  );
});

const styles = StyleSheet.create({
  box: { width: 28, height: 28, position: 'relative' },
  active: { borderColor: '#B9C2FF', backgroundColor: '#B9C2FF' },
  inactive: { borderColor: '#68738D', backgroundColor: '#68738D' },
  roofLeft: { position: 'absolute', width: 14, height: 3, borderRadius: 2, transform: [{ rotate: '-40deg' }], left: 2, top: 7 },
  roofRight: { position: 'absolute', width: 14, height: 3, borderRadius: 2, transform: [{ rotate: '40deg' }], right: 2, top: 7 },
  homeBody: { position: 'absolute', left: 6, right: 6, bottom: 4, height: 13, borderRadius: 3 },
  homeDoor: { position: 'absolute', width: 5, height: 8, bottom: 4, left: 12, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  doorActive: { backgroundColor: '#151B2B' },
  doorInactive: { backgroundColor: '#111725' },
  bookLeft: { position: 'absolute', left: 3, top: 5, width: 10, height: 18, borderRadius: 3, borderWidth: 2, backgroundColor: 'transparent' },
  bookRight: { position: 'absolute', right: 3, top: 5, width: 10, height: 18, borderRadius: 3, borderWidth: 2, backgroundColor: 'transparent' },
  bookSpine: { position: 'absolute', left: 13, top: 6, width: 2, height: 16 },
  spineActive: { backgroundColor: '#B9C2FF' },
  spineInactive: { backgroundColor: '#68738D' },
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
