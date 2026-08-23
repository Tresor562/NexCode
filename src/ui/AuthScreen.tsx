import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { theme } from './theme';

type Mode = 'signin' | 'signup';

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'words';
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  rightAction?: { label: string; onPress: () => void };
};

function AuthField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoComplete,
  textContentType,
  returnKeyType,
  onSubmitEditing,
  rightAction,
}: FieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputShell, focused && styles.inputShellFocused]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          style={styles.input}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          textContentType={textContentType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label}
        />
        {rightAction ? (
          <Pressable
            onPress={rightAction.onPress}
            accessibilityRole="button"
            accessibilityLabel={rightAction.label}
            hitSlop={10}
            style={({ pressed }) => [styles.inputAction, pressed && styles.inputActionPressed]}
          >
            <Text style={styles.inputActionText}>{rightAction.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

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
  const [showPassword, setShowPassword] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();
  const hasEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const hasPassword = password.length >= 6;
  const hasName = displayName.trim().length >= 2;
  const valid = hasEmail && hasPassword && (mode === 'signin' || hasName);

  const helper = useMemo(() => {
    if (!email && !password && mode === 'signin') return 'Reprends exactement là où tu t’étais arrêté.';
    if (!hasEmail && email.length > 0) return 'Entre une adresse email valide.';
    if (!hasPassword && password.length > 0) return 'Ton mot de passe doit contenir au moins 6 caractères.';
    if (mode === 'signup' && displayName.length > 0 && !hasName) return 'Choisis un nom d’au moins 2 caractères.';
    return mode === 'signup'
      ? 'Ton compte sauvegardera progression, projets et récompenses.'
      : 'Progression cloud, projets et récompenses sont synchronisés.';
  }, [displayName.length, email, hasEmail, hasName, hasPassword, mode, password.length]);

  const switchMode = (nextMode: Mode) => {
    if (nextMode === mode || busy) return;
    Haptics.selectionAsync().catch(() => undefined);
    setMode(nextMode);
  };

  const submit = () => {
    if (!valid || busy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    onSubmit({
      mode,
      email: normalizedEmail,
      password,
      displayName: displayName.trim() || undefined,
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.ambientTop} />
        <View style={styles.content}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>NC</Text>
              <View style={styles.brandGlow} />
            </View>
            <View style={styles.brandCopy}>
              <Text style={styles.brandName}>NexCode</Text>
              <Text style={styles.brandTag}>LEARN · BUILD · MASTER</Text>
            </View>
          </View>

          <Text style={styles.eyebrow}>{mode === 'signin' ? 'ESPACE APPRENANT' : 'NOUVEAU PARCOURS'}</Text>
          <Text style={styles.title}>{mode === 'signin' ? 'Bon retour.' : 'Crée ton compte.'}</Text>
          <Text style={styles.subtitle}>
            {mode === 'signin'
              ? 'Retrouve ton parcours, ton XP, tes NexCoins et tes projets.'
              : 'Commence sur un appareil et continue sur un autre sans perdre ta progression.'}
          </Text>

          <View style={styles.switcher} accessibilityRole="tablist">
            <Pressable
              onPress={() => switchMode('signin')}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === 'signin' }}
              style={[styles.switchButton, mode === 'signin' && styles.switchActive]}
            >
              <Text style={[styles.switchText, mode === 'signin' && styles.switchTextActive]}>Connexion</Text>
            </Pressable>
            <Pressable
              onPress={() => switchMode('signup')}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === 'signup' }}
              style={[styles.switchButton, mode === 'signup' && styles.switchActive]}
            >
              <Text style={[styles.switchText, mode === 'signup' && styles.switchTextActive]}>Créer un compte</Text>
            </Pressable>
          </View>

          {mode === 'signup' ? (
            <AuthField
              label="Nom affiché"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Prénom ou pseudo"
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
            />
          ) : null}

          <AuthField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="toi@exemple.com"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
          />

          <AuthField
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            placeholder="6 caractères minimum"
            secureTextEntry={!showPassword}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            textContentType={mode === 'signup' ? 'newPassword' : 'password'}
            returnKeyType="go"
            onSubmitEditing={submit}
            rightAction={{
              label: showPassword ? 'Masquer' : 'Afficher',
              onPress: () => {
                Haptics.selectionAsync().catch(() => undefined);
                setShowPassword((value) => !value);
              },
            }}
          />

          <View style={[styles.helperCard, error ? styles.helperCardError : null]}>
            <View style={[styles.helperDot, error ? styles.helperDotError : null]} />
            <Text style={[styles.helperText, error ? styles.errorText : null]}>{error || helper}</Text>
          </View>

          <Pressable
            disabled={!valid || busy}
            onPress={submit}
            accessibilityRole="button"
            accessibilityState={{ disabled: !valid || busy, busy }}
            style={({ pressed }) => [
              styles.primaryDepth,
              (!valid || busy) && styles.primaryDisabled,
              pressed && valid && !busy && styles.primaryDepthPressed,
            ]}
          >
            <View style={styles.primaryFace}>
              {busy ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
              <Text style={styles.primaryText}>
                {busy ? 'Synchronisation…' : mode === 'signin' ? 'Continuer' : 'Créer mon compte'}
              </Text>
            </View>
          </Pressable>

          <Text style={styles.privacy}>
            Tes données de progression restent liées à ton compte NexCode et sont récupérables sur tes appareils.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  root: { flex: 1, justifyContent: 'center', overflow: 'hidden' },
  ambientTop: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(109,124,255,.08)',
    top: -180,
    right: -110,
  },
  content: { paddingHorizontal: 22, paddingVertical: 18 },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
  brandMark: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: 'rgba(78,103,255,.16)',
    borderWidth: 1,
    borderColor: 'rgba(139,154,255,.34)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  brandMarkText: { color: '#DDE3FF', fontSize: 22, fontWeight: '900', letterSpacing: -2 },
  brandGlow: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(105,78,255,.19)',
    right: -18,
    bottom: -22,
  },
  brandCopy: { marginLeft: 13 },
  brandName: { color: theme.colors.text, fontSize: 17, fontWeight: '900', letterSpacing: -.4 },
  brandTag: { color: theme.colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1.25, marginTop: 3 },
  eyebrow: { color: theme.colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.4, marginBottom: 7 },
  title: { color: theme.colors.text, fontSize: 36, lineHeight: 40, fontWeight: '900', letterSpacing: -1.3 },
  subtitle: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 9, marginBottom: 24, maxWidth: 350 },
  switcher: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.07)',
    marginBottom: 18,
  },
  switchButton: { flex: 1, minHeight: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  switchActive: { backgroundColor: 'rgba(101,121,255,.17)', borderWidth: 1, borderColor: 'rgba(138,153,255,.24)' },
  switchText: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '800' },
  switchTextActive: { color: '#D8DEFF' },
  fieldGroup: { marginBottom: 12 },
  fieldLabel: { color: theme.colors.textSecondary, fontSize: 11, fontWeight: '800', marginBottom: 7, marginLeft: 2 },
  inputShell: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.08)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputShellFocused: { borderColor: 'rgba(109,124,255,.7)', backgroundColor: 'rgba(109,124,255,.055)' },
  input: { flex: 1, minHeight: 56, paddingHorizontal: 16, color: theme.colors.text, fontSize: 15 },
  inputAction: { minHeight: 40, paddingHorizontal: 14, justifyContent: 'center' },
  inputActionPressed: { opacity: .65 },
  inputActionText: { color: theme.colors.primary, fontSize: 11, fontWeight: '900' },
  helperCard: {
    minHeight: 42,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(109,124,255,.055)',
    borderWidth: 1,
    borderColor: 'rgba(109,124,255,.12)',
    marginBottom: 12,
  },
  helperCardError: { backgroundColor: 'rgba(255,120,138,.055)', borderColor: 'rgba(255,120,138,.18)' },
  helperDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.primary, marginRight: 9 },
  helperDotError: { backgroundColor: theme.colors.danger },
  helperText: { flex: 1, color: theme.colors.textMuted, fontSize: 11, lineHeight: 16 },
  errorText: { color: '#FF9AA7' },
  primaryDepth: {
    minHeight: 61,
    borderRadius: 19,
    backgroundColor: '#3F4FC8',
    marginTop: 4,
    paddingBottom: 5,
    shadowColor: '#536CFF',
    shadowOpacity: .24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
    elevation: 7,
  },
  primaryFace: {
    minHeight: 56,
    borderRadius: 19,
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryDepthPressed: { paddingBottom: 2, transform: [{ translateY: 3 }] },
  primaryDisabled: { opacity: .38 },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: .15 },
  privacy: { color: theme.colors.textMuted, fontSize: 10.5, lineHeight: 16, textAlign: 'center', marginTop: 15, paddingHorizontal: 10 },
});
