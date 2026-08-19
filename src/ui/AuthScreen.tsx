import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

type Mode = 'signin' | 'signup';

export function AuthScreen({
  busy = false,
  error,
  onSubmit,
}: {
  busy?: boolean;
  error?: string;
  onSubmit: (payload: { mode: Mode; email: string; password: string; displayName?: string }) => Promise<void> | void;
}) {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const valid = email.includes('@') && password.length >= 6 && (mode === 'signin' || displayName.trim().length >= 2);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>NC</Text><View style={styles.brandGlow} /></View>
        <Text style={styles.title}>{mode === 'signin' ? 'Bon retour.' : 'Crée ton compte.'}</Text>
        <Text style={styles.subtitle}>{mode === 'signin' ? 'Retrouve ton parcours, ton XP, tes NexCoins et tes projets.' : 'Ta progression te suivra sur tous tes appareils.'}</Text>

        <View style={styles.switcher}>
          <Pressable onPress={() => setMode('signin')} style={[styles.switchButton, mode === 'signin' && styles.switchActive]}><Text style={[styles.switchText, mode === 'signin' && styles.switchTextActive]}>Connexion</Text></Pressable>
          <Pressable onPress={() => setMode('signup')} style={[styles.switchButton, mode === 'signup' && styles.switchActive]}><Text style={[styles.switchText, mode === 'signup' && styles.switchTextActive]}>Créer un compte</Text></Pressable>
        </View>

        {mode === 'signup' ? <TextInput value={displayName} onChangeText={setDisplayName} placeholder="Prénom ou pseudo" placeholderTextColor="#5F6B83" style={styles.input} autoCapitalize="words" /> : null}
        <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor="#5F6B83" style={styles.input} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        <TextInput value={password} onChangeText={setPassword} placeholder="Mot de passe" placeholderTextColor="#5F6B83" style={styles.input} secureTextEntry autoCapitalize="none" />
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable disabled={!valid || busy} onPress={() => onSubmit({ mode, email: email.trim(), password, displayName: displayName.trim() || undefined })} style={({ pressed }) => [styles.primary, (!valid || busy) && styles.primaryDisabled, pressed && valid && !busy && styles.primaryPressed]}>
          <Text style={styles.primaryText}>{busy ? 'Connexion…' : mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}</Text>
        </Pressable>
        <Text style={styles.privacy}>Tes données de progression restent liées à ton compte NexCode.</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#070B16' },
  root: { flex: 1, paddingHorizontal: 22, justifyContent: 'center' },
  brandMark: { width: 76, height: 76, borderRadius: 24, backgroundColor: 'rgba(78,103,255,.16)', borderWidth: 1, borderColor: 'rgba(139,154,255,.34)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 24 },
  brandMarkText: { color: '#DDE3FF', fontSize: 24, fontWeight: '900', letterSpacing: -2 },
  brandGlow: { position: 'absolute', width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(105,78,255,.18)', right: -20, bottom: -20 },
  title: { color: '#F5F7FF', fontSize: 34, lineHeight: 39, fontWeight: '900', letterSpacing: -1 },
  subtitle: { color: '#8A95AD', fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 24 },
  switcher: { flexDirection: 'row', padding: 4, borderRadius: 17, backgroundColor: 'rgba(255,255,255,.045)', borderWidth: 1, borderColor: 'rgba(255,255,255,.07)', marginBottom: 16 },
  switchButton: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13 },
  switchActive: { backgroundColor: 'rgba(101,121,255,.17)', borderWidth: 1, borderColor: 'rgba(138,153,255,.24)' },
  switchText: { color: '#657087', fontSize: 12, fontWeight: '800' },
  switchTextActive: { color: '#C9D1FF' },
  input: { minHeight: 58, borderRadius: 18, backgroundColor: 'rgba(255,255,255,.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,.08)', paddingHorizontal: 16, color: '#F3F5FF', fontSize: 15, marginBottom: 10 },
  primary: { minHeight: 58, borderRadius: 18, backgroundColor: '#6578FF', alignItems: 'center', justifyContent: 'center', marginTop: 6, shadowColor: '#536CFF', shadowOpacity: .28, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  primaryDisabled: { opacity: .4 },
  primaryPressed: { transform: [{ scale: .985 }] },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  error: { color: '#FF8D9A', fontSize: 12, lineHeight: 18, marginVertical: 4 },
  privacy: { color: '#566077', fontSize: 10.5, lineHeight: 16, textAlign: 'center', marginTop: 14 },
});
