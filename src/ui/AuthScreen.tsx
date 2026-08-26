import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { shadows, theme } from './theme';

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
  onResetPassword,
}: {
  busy?: boolean;
  error?: string;
  onSubmit: (payload: { mode: Mode; email: string; password: string; displayName?: string }) => Promise<void> | void;
  onResetPassword?: (email: string) => Promise<void> | void;
}) {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetNotice, setResetNotice] = useState<string | undefined>();
  const [resetFailure, setResetFailure] = useState<string | undefined>();

  const normalizedEmail = email.trim().toLowerCase();
  const hasEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const hasPassword = password.length >= 6;
  const hasName = displayName.trim().length >= 2;
  const passwordsMatch = mode === 'signin' || (confirmPassword.length > 0 && confirmPassword === password);
  const valid = hasEmail && hasPassword && passwordsMatch && (mode === 'signin' || hasName);
  const authLocked = busy || resetBusy;

  const helper = useMemo(() => {
    if (!email && !password && mode === 'signin') return 'Reprends exactement là où tu t’étais arrêté.';
    if (!hasEmail && email.length > 0) return 'Entre une adresse email valide.';
    if (!hasPassword && password.length > 0) return 'Ton mot de passe doit contenir au moins 6 caractères.';
    if (mode === 'signup' && displayName.length > 0 && !hasName) return 'Choisis un nom d’au moins 2 caractères.';
    if (mode === 'signup' && confirmPassword.length > 0 && !passwordsMatch) return 'Les deux mots de passe ne correspondent pas.';
    if (mode === 'signup' && hasPassword && confirmPassword.length === 0) return 'Confirme ton mot de passe pour éviter une faute de frappe.';
    return mode === 'signup'
      ? 'Ton compte sauvegardera progression, projets et récompenses.'
      : 'Progression cloud, projets et récompenses sont synchronisés.';
  }, [confirmPassword.length, displayName.length, email, hasEmail, hasName, hasPassword, mode, password.length, passwordsMatch]);

  const switchMode = (nextMode: Mode) => {
    if (nextMode === mode || authLocked) return;
    Haptics.selectionAsync().catch(() => undefined);
    setMode(nextMode);
    setConfirmPassword('');
    setResetNotice(undefined);
    setResetFailure(undefined);
  };

  const submit = () => {
    if (!valid || authLocked) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setResetNotice(undefined);
    setResetFailure(undefined);
    onSubmit({
      mode,
      email: normalizedEmail,
      password,
      displayName: displayName.trim() || undefined,
    });
  };

  const recoverPassword = async () => {
    if (!onResetPassword || resetBusy || busy) return;
    setResetNotice(undefined);
    setResetFailure(undefined);
    if (!hasEmail) {
      setResetFailure('Entre d’abord l’adresse email de ton compte NexCode.');
      return;
    }

    setResetBusy(true);
    Haptics.selectionAsync().catch(() => undefined);
    try {
      await onResetPassword(normalizedEmail);
      // Keep this message deliberately non-enumerating: it must not reveal whether
      // an email address is registered in Supabase.
      setResetNotice('Si un compte correspond à cette adresse, un lien de réinitialisation vient d’être envoyé. Vérifie aussi les spams.');
    } catch (resetError) {
      setResetFailure(resetError instanceof Error ? resetError.message : 'Impossible d’envoyer le lien pour le moment. Réessaie dans quelques instants.');
    } finally {
      setResetBusy(false);
    }
  };

  const visibleMessage = resetFailure || resetNotice || error || helper;
  const visibleError = Boolean(resetFailure || error);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={styles.ambientTop} />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
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
                accessibilityState={{ selected: mode === 'signin', disabled: authLocked }}
                style={[styles.switchButton, mode === 'signin' && styles.switchActive]}
              >
                <Text style={[styles.switchText, mode === 'signin' && styles.switchTextActive]}>Connexion</Text>
              </Pressable>
              <Pressable
                onPress={() => switchMode('signup')}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === 'signup', disabled: authLocked }}
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
              onChangeText={(value) => {
                setEmail(value);
                setResetNotice(undefined);
                setResetFailure(undefined);
              }}
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
              returnKeyType={mode === 'signup' ? 'next' : 'go'}
              onSubmitEditing={mode === 'signin' ? submit : undefined}
              rightAction={{
                label: showPassword ? 'Masquer' : 'Afficher',
                onPress: () => {
                  Haptics.selectionAsync().catch(() => undefined);
                  setShowPassword((value) => !value);
                },
              }}
            />

            {mode === 'signin' && onResetPassword ? (
              <View style={styles.recoveryRow}>
                <Pressable
                  onPress={recoverPassword}
                  disabled={authLocked}
                  accessibilityRole="button"
                  accessibilityLabel="Réinitialiser le mot de passe"
                  accessibilityHint="Envoie un lien de réinitialisation à l’adresse email saisie"
                  accessibilityState={{ disabled: authLocked, busy: resetBusy }}
                  hitSlop={10}
                  style={({ pressed }) => [styles.recoveryButton, pressed && !authLocked && styles.recoveryButtonPressed]}
                >
                  {resetBusy ? <ActivityIndicator color={theme.colors.primary} size="small" /> : null}
                  <Text style={styles.recoveryText}>{resetBusy ? 'Envoi du lien…' : 'Mot de passe oublié ?'}</Text>
                </Pressable>
              </View>
            ) : null}

            {mode === 'signup' ? (
              <AuthField
                label="Confirmer le mot de passe"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Retape le même mot de passe"
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="go"
                onSubmitEditing={submit}
              />
            ) : null}

            <View style={[styles.helperCard, visibleError ? styles.helperCardError : null, resetNotice ? styles.helperCardSuccess : null]}>
              <View style={[styles.helperDot, visibleError ? styles.helperDotError : null, resetNotice ? styles.helperDotSuccess : null]} />
              <Text
                style={[styles.helperText, visibleError ? styles.errorText : null, resetNotice ? styles.successText : null]}
                accessibilityLiveRegion={visibleError ? 'assertive' : 'polite'}
              >
                {visibleMessage}
              </Text>
            </View>

            <Pressable
              disabled={!valid || authLocked}
              onPress={submit}
              accessibilityRole="button"
              accessibilityState={{ disabled: !valid || authLocked, busy }}
              style={({ pressed }) => [
                styles.primaryDepth,
                (!valid || authLocked) && styles.primaryDisabled,
                pressed && valid && !authLocked && styles.primaryDepthPressed,
              ]}
            >
              <View style={styles.primaryFace}>
                {busy ? <ActivityIndicator color={theme.colors.white} size="small" /> : null}
                <Text style={styles.primaryText}>
                  {busy ? 'Synchronisation…' : mode === 'signin' ? 'Continuer' : 'Créer mon compte'}
                </Text>
              </View>
            </Pressable>

            <Text style={styles.privacy}>
              Tes données de progression restent liées à ton compte NexCode et sont récupérables sur tes appareils.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  root: { flex: 1, overflow: 'hidden' },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  ambientTop: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: theme.colors.primaryGlass,
    opacity: 0.5,
    top: -180,
    right: -110,
  },
  content: { paddingHorizontal: theme.space.xl, paddingVertical: theme.space.lg },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
  brandMark: {
    width: 68,
    height: 68,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.primaryGlass,
    borderWidth: 1,
    borderColor: theme.colors.primaryBorderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  brandMarkText: { color: theme.colors.primaryText, fontSize: theme.type.titleLarge, fontWeight: theme.weight.black, letterSpacing: -2 },
  brandGlow: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primarySurface,
    right: -18,
    bottom: -22,
  },
  brandCopy: { marginLeft: 13 },
  brandName: { color: theme.colors.text, fontSize: 17, fontWeight: theme.weight.black, letterSpacing: -.4 },
  brandTag: { color: theme.colors.textMuted, fontSize: 9, fontWeight: theme.weight.bold, letterSpacing: 1.25, marginTop: 3 },
  eyebrow: { color: theme.colors.primaryBright, fontSize: 10, fontWeight: theme.weight.black, letterSpacing: 1.4, marginBottom: 7 },
  title: { color: theme.colors.text, fontSize: 36, lineHeight: 40, fontWeight: theme.weight.black, letterSpacing: -1.3 },
  subtitle: { color: theme.colors.textSecondary, fontSize: theme.type.body, lineHeight: 21, marginTop: 9, marginBottom: theme.space.xl, maxWidth: 350 },
  switcher: {
    flexDirection: 'row',
    padding: theme.space.xxs,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceStat,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    marginBottom: theme.space.lg,
  },
  switchButton: { flex: 1, minHeight: theme.control.heightSm, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.md },
  switchActive: { backgroundColor: theme.colors.primaryGlass, borderWidth: 1, borderColor: theme.colors.primaryBorder },
  switchText: { color: theme.colors.textMuted, fontSize: theme.type.label, fontWeight: theme.weight.bold },
  switchTextActive: { color: theme.colors.primaryText },
  fieldGroup: { marginBottom: theme.space.md },
  fieldLabel: { color: theme.colors.textSecondary, fontSize: 11, fontWeight: theme.weight.bold, marginBottom: 7, marginLeft: 2 },
  inputShell: {
    minHeight: 58,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceStat,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputShellFocused: { borderColor: theme.colors.primaryBright, backgroundColor: theme.colors.primarySurface },
  input: { flex: 1, minHeight: 56, paddingHorizontal: 16, color: theme.colors.text, fontSize: 15 },
  inputAction: { minHeight: theme.control.heightSm, paddingHorizontal: theme.space.md, justifyContent: 'center' },
  inputActionPressed: { opacity: .65 },
  inputActionText: { color: theme.colors.primaryBright, fontSize: 11, fontWeight: theme.weight.black },
  recoveryRow: { alignItems: 'flex-end', marginTop: -4, marginBottom: theme.space.sm },
  recoveryButton: { minHeight: theme.control.heightSm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: theme.space.xxs },
  recoveryButtonPressed: { opacity: .65 },
  recoveryText: { color: theme.colors.primaryBright, fontSize: 11.5, fontWeight: theme.weight.black },
  helperCard: {
    minHeight: 42,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.md,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primarySurface,
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
    marginBottom: theme.space.md,
  },
  helperCardError: { backgroundColor: theme.colors.warningGlass, borderColor: theme.colors.warningBorder },
  helperCardSuccess: { backgroundColor: theme.colors.successGlass, borderColor: theme.colors.successBorder },
  helperDot: { width: 6, height: 6, borderRadius: theme.radius.pill, backgroundColor: theme.colors.primaryBright, marginRight: 9 },
  helperDotError: { backgroundColor: theme.colors.danger },
  helperDotSuccess: { backgroundColor: theme.colors.success },
  helperText: { flex: 1, color: theme.colors.textMuted, fontSize: 11, lineHeight: 16 },
  errorText: { color: theme.colors.danger },
  successText: { color: theme.colors.success },
  primaryDepth: {
    minHeight: 61,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primarySoft,
    marginTop: theme.space.xxs,
    paddingBottom: 5,
    ...shadows.primaryGlow,
  },
  primaryFace: {
    minHeight: 56,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryDepthPressed: { paddingBottom: 2, transform: [{ translateY: theme.motion.pressedDepth }] },
  primaryDisabled: { opacity: .38 },
  primaryText: { color: theme.colors.white, fontSize: theme.type.body, fontWeight: theme.weight.black, letterSpacing: .15 },
  privacy: { color: theme.colors.textMuted, fontSize: theme.type.caption, lineHeight: 16, textAlign: 'center', marginTop: 15, paddingHorizontal: theme.space.sm },
});