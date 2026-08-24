import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import NexCodeApp from './NexCodeApp';
import { LaunchScreen } from './LaunchScreen';
import { AuthScreen } from './AuthScreen';
import { PasswordResetScreen } from './PasswordResetScreen';
import { loadLocalState, saveLocalState } from '../lib/localState';
import { bindLocalStateOwner, scopeLocalStateForUser } from '../lib/accountScope';
import {
  consumePasswordRecoveryUrl,
  requestPasswordReset,
  updatePasswordFromRecoverySession,
} from '../lib/authRecovery';
import {
  CloudSession,
  isCloudConfigured,
  loadCloudSession,
  pullCloudState,
  saveCloudSession,
  signInWithPassword,
  signUpWithPassword,
} from '../lib/cloudAccount';

export default function RootApp() {
  const cloudEnabled = isCloudConfigured();
  const [launched, setLaunched] = useState(false);
  const [session, setSession] = useState<CloudSession | null>(() => loadCloudSession());
  const [recoverySession, setRecoverySession] = useState<CloudSession | null>(null);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | undefined>();
  const [hydrating, setHydrating] = useState(() => cloudEnabled && Boolean(loadCloudSession()));
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | undefined>();
  const finishLaunch = useCallback(() => setLaunched(true), []);

  useEffect(() => {
    let active = true;
    let recoveryRequestGeneration = 0;

    const handleRecoveryUrl = async (url: string) => {
      const generation = ++recoveryRequestGeneration;
      try {
        const recovered = await consumePasswordRecoveryUrl(url);
        // Deep links can arrive nearly simultaneously (for example the initial
        // URL plus a foreground Linking event). Only the newest request may
        // take over the recovery UI; an older network response must never
        // overwrite a newer verified link or its error state.
        if (!active || generation !== recoveryRequestGeneration || !recovered) return;
        // A verified recovery link temporarily takes over the foreground flow,
        // but its short-lived credentials are not persisted. If the user
        // cancels or the app restarts before success, the previous durable app
        // session (if any) remains the only session eligible for hydration.
        setSession(null);
        setHydrating(false);
        setAuthError(undefined);
        setRecoveryError(undefined);
        setRecoverySession(recovered);
      } catch (error) {
        if (!active || generation !== recoveryRequestGeneration) return;
        setRecoveryError(undefined);
        setAuthError(error instanceof Error ? error.message : 'Ce lien de réinitialisation est invalide ou a expiré.');
      }
    };

    void Linking.getInitialURL().then((url) => {
      if (url) void handleRecoveryUrl(url);
    });
    const subscription = Linking.addEventListener('url', ({ url }) => {
      void handleRecoveryUrl(url);
    });

    return () => {
      active = false;
      recoveryRequestGeneration += 1;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!launched || !cloudEnabled || !session || recoverySession) return;
    let active = true;
    setHydrating(true);
    const scopedLocal = scopeLocalStateForUser(loadLocalState(), session.user.id);
    void pullCloudState(session, scopedLocal)
      .then(({ session: refreshed, state }) => {
        if (!active) return;
        saveCloudSession(refreshed);
        bindLocalStateOwner(refreshed.user.id);
        saveLocalState(state);
        setSession(refreshed);
      })
      .catch(() => {
        // Offline-first: continue with the snapshot scoped to this account. If
        // the device has just switched accounts, this is intentionally a fresh
        // local state rather than another learner's XP, mastery or projects.
        if (!active) return;
        bindLocalStateOwner(session.user.id);
        saveLocalState(scopedLocal);
      })
      .finally(() => {
        if (active) setHydrating(false);
      });
    return () => { active = false; };
  }, [launched, cloudEnabled, session?.user.id, recoverySession]);

  async function submitAuth(payload: { mode: 'signin' | 'signup'; email: string; password: string; displayName?: string }) {
    setAuthBusy(true);
    setAuthError(undefined);
    try {
      if (payload.mode === 'signin') {
        const signedIn = await signInWithPassword(payload.email, payload.password);
        setSession(signedIn);
        return;
      }
      const result = await signUpWithPassword(payload.email, payload.password, payload.displayName ?? '');
      if (result.kind === 'confirm-email') {
        setAuthError(`Compte créé. Confirme l’adresse ${result.email}, puis connecte-toi.`);
        return;
      }
      setSession(result.session);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Connexion impossible pour le moment.');
    } finally {
      setAuthBusy(false);
    }
  }

  async function recoverPassword(email: string) {
    await requestPasswordReset(email);
  }

  async function completePasswordReset(password: string) {
    if (!recoverySession || recoveryBusy) return;
    setRecoveryBusy(true);
    setRecoveryError(undefined);
    try {
      const updated = await updatePasswordFromRecoverySession(recoverySession, password);
      // Promote recovery credentials to the normal app session only after the
      // password mutation succeeds and Supabase confirms the same user.
      saveCloudSession(updated);
      setRecoverySession(null);
      setSession(updated);
    } catch (error) {
      setRecoveryError(error instanceof Error ? error.message : 'Impossible de mettre à jour le mot de passe. Demande un nouveau lien.');
    } finally {
      setRecoveryBusy(false);
    }
  }

  function cancelPasswordReset() {
    if (recoveryBusy) return;
    // Recovery credentials were never persisted. Restore the durable session
    // that existed before the recovery flow, if one is still available, rather
    // than signing the learner out or promoting a temporary recovery token.
    const restored = loadCloudSession();
    setRecoverySession(null);
    setSession(restored);
    setHydrating(cloudEnabled && Boolean(restored));
    setRecoveryError(undefined);
    setAuthError(undefined);
  }

  if (!launched) return <LaunchScreen onDone={finishLaunch} />;
  if (recoverySession) {
    return (
      <PasswordResetScreen
        email={recoverySession.user.email}
        busy={recoveryBusy}
        error={recoveryError}
        onSubmit={completePasswordReset}
        onCancel={cancelPasswordReset}
      />
    );
  }
  if (cloudEnabled && !session) {
    return (
      <AuthScreen
        busy={authBusy}
        error={authError}
        onSubmit={submitAuth}
        onResetPassword={recoverPassword}
      />
    );
  }
  if (hydrating) return <SafeAreaView style={styles.safe}><View style={styles.loading}><ActivityIndicator size="small" color="#8390FF" /><Text style={styles.loadingTitle}>Synchronisation de ton parcours</Text><Text style={styles.loadingMeta}>XP, série, maîtrise et projets sont réunis sur cet appareil.</Text></View></SafeAreaView>;
  return <NexCodeApp />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#070B16' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  loadingTitle: { color: '#F5F7FF', fontSize: 16, fontWeight: '900', marginTop: 18, textAlign: 'center' },
  loadingMeta: { color: '#7B879F', fontSize: 12, lineHeight: 18, marginTop: 7, textAlign: 'center', maxWidth: 310 },
});
