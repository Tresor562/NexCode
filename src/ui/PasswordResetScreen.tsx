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
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { theme } from './theme';

export function PasswordResetScreen({
  email,
  busy = false,
  error,
  onSubmit,
  onCancel,
}: {
  email?: string;
  busy?: boolean;
  error?: string;
  onSubmit: (password: string) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<'password' | 'confirm' | null>(null);

  const hasPassword = password.length >= 6;
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const valid = hasPassword && passwordsMatch && !busy;
  const helper = useMemo(() => {
    if (error) return error;
    if (password.length > 0 && !hasPassword) return 'Choisis au moins 6 caractères.';
    if (confirmPassword.length > 0 && !passwordsMatch) return 'Les deux mots de passe ne correspondent pas.';
    if (hasPassword && confirmPassword.length === 0) return 'Confirme le nouveau mot de passe avant de continuer.';
    return 'Le lien a été vérifié. Choisis maintenant un nouveau mot de passe pour ton compte.';
  }, [confirmPassword.length, error, hasPassword, password.length, passwordsMatch]);

  const submit = () => {
    if (!valid) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    void onSubmit(password);
  };

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
            <View style={styles.brandMark} accessibilityElementsHidden>
              <Text style={styles.brandMarkText}>NC</Text>
            </View>
            <Text style={styles.eyebrow}>SÉCURITÉ DU COMPTE</Text>
            <Text style={styles.title}>Nouveau mot de passe.</Text>
            <Text style={styles.subtitle}>
              {email ? `Le lien de récupération pour ${email} est valide.` : 'Ton lien de récupération NexCode est valide.'}
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Nouveau mot de passe</Text>
              <View style={[styles.inputShell, focusedField === 'password' && styles.inputShellFocused]}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="6 caractères minimum"
                  placeholderTextColor={theme.colors.textMuted}
                  style={styles.input}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="next"
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  accessibilityLabel="Nouveau mot de passe"
                />
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => undefined);
                    setShowPassword((value) => !value);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  hitSlop={10}
                  style={({ pressed }) => [styles.inlineAction, pressed && styles.inlineActionPressed]}
                >
                  <Text style={styles.inlineActionText}>{showPassword ? 'Masquer' : 'Afficher'}</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Confirmer le mot de passe</Text>
              <View style={[styles.inputShell, focusedField === 'confirm' && styles.inputShellFocused]}>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Retape le même mot de passe"
                  placeholderTextColor={theme.colors.textMuted}
                  style={styles.input}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="go"
                  onSubmitEditing={submit}
                  onFocus={() => setFocusedField('confirm')}
                  onBlur={() => setFocusedField(null)}
                  accessibilityLabel="Confirmer le nouveau mot de passe"
                />
              </View>
            </View>

            <View style={[styles.helperCard, error ? styles.helperCardError : null]}>
              <View style={[styles.helperDot, error ? styles.helperDotError : null]} />
              <Text
                style={[styles.helperText, error ? styles.errorText : null]}
                accessibilityLiveRegion={error ? 'assertive' : 'polite'}
              >
                {helper}
              </Text>
            </View>

            <Pressable
              disabled={!valid}
              onPress={submit}
              accessibilityRole="button"
              accessibilityLabel="Enregistrer le nouveau mot de passe"
              accessibilityState={{ disabled: !valid, busy }}
              style={({ pressed }) => [styles.primary, !valid && styles.primaryDisabled, pressed && valid && styles.primaryPressed]}
            >
              {busy ? <ActivityIndicator color={theme.colors.white} size="small" /> : null}
              <Text style={styles.primaryText}>{busy ? 'Mise à jour…' : 'Enregistrer et continuer'}</Text>
            </Pressable>

            <Pressable
              disabled={busy}
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Annuler la réinitialisation"
              style={({ pressed }) => [styles.secondary, pressed && !busy && styles.secondaryPressed]}
            >
              <Text style={styles.secondaryText}>Annuler et revenir à la connexion</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  root: { flex: 1, overflow: 'hidden' },
  ambientTop: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: theme.colors.primaryGlass,
    top: -180,
    right: -110,
    opacity: 0.5,
  },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  content: { paddingHorizontal: 22, paddingVertical: 28 },
  brandMark: {
    width: 58,
    height: 58,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primaryGlass,
    borderWidth: 1,
    borderColor: theme.colors.primaryBorderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  brandMarkText: { color: theme.colors.primaryText, fontSize: 20, fontWeight: theme.weight.black, letterSpacing: -2 },
  eyebrow: { color: theme.colors.primary, fontSize: 10, fontWeight: theme.weight.black, letterSpacing: 1.4, marginBottom: 7 },
  title: { color: theme.colors.text, fontSize: 34, lineHeight: 39, fontWeight: theme.weight.black, letterSpacing: -1.2 },
  subtitle: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 9, marginBottom: 28 },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: theme.weight.bold, marginBottom: 8 },
  inputShell: {
    minHeight: 58,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderControl,
    backgroundColor: theme.colors.surfaceStat,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputShellFocused: {
    borderColor: theme.colors.primaryBorderStrong,
    backgroundColor: theme.colors.primarySurface,
  },
  input: { flex: 1, color: theme.colors.text, fontSize: 15, paddingHorizontal: 16, paddingVertical: 15 },
  inlineAction: { minHeight: 44, minWidth: 72, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  inlineActionPressed: { opacity: 0.7 },
  inlineActionText: { color: theme.colors.primary, fontSize: 12, fontWeight: theme.weight.black },
  helperCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primarySurface,
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
    padding: 13,
    marginTop: 2,
    marginBottom: 20,
  },
  helperCardError: { backgroundColor: theme.colors.warningGlass, borderColor: theme.colors.danger },
  helperDot: { width: 7, height: 7, borderRadius: 4, marginTop: 5, backgroundColor: theme.colors.primary },
  helperDotError: { backgroundColor: theme.colors.danger },
  helperText: { flex: 1, color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18 },
  errorText: { color: theme.colors.danger },
  primary: {
    minHeight: 58,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  primaryDisabled: { opacity: 0.42 },
  primaryPressed: { transform: [{ translateY: 1 }] },
  primaryText: { color: theme.colors.white, fontSize: 14, fontWeight: theme.weight.black },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  secondaryPressed: { opacity: 0.65 },
  secondaryText: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: theme.weight.bold },
});