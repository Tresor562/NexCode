import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Linking, SafeAreaView, StyleSheet, Text, View } from 'react-native';
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
import { flushCloudStateNow } from '../lib/cloudSync';
import { theme } from './theme';

type SyncNotice = { kind: 'offline-fallback'; message: string } | null;

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
  const [syncNotice, setSyncNotice] = useState<SyncNotice>(null);
  const finishLaunch = useCallback(() => setLaunched(true), []);

  useEffect(() => {
    let active = true;
    let recoveryRequestGeneration = 0;

    const handleRecoveryUrl = async (url: string) => {
      const generation = ++recoveryRequestGeneration;
      try {
        const recovered = await consumePasswordRecoveryUrl(url);
        if (!active || generation !== recoveryRequestGeneration || !recovered) return;
        setSession(null);
        setHydrating(false);
        setAuthError(undefined);
        setRecoveryError(undefined);
        setSyncNotice(null);
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
    if (!cloudEnabled) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') void flushCloudStateNow();
    });
    return () => subscription.remove();
  }, [cloudEnabled]);

  useEffect(() => {
    if (!launched || !cloudEnabled || !session || recoverySession) return;
    let active = true;
    setHydrating(true);
    setSyncNotice(null);
    const scopedLocal = scopeLocalStateForUser(loadLocalState(), session.user.id);
    void pullCloudState(session, scopedLocal)
      .then(({ session: refreshed, state }) => {
        if (!active) return;
        saveCloudSession(refreshed);
        bindLocalStateOwner(refreshed.user.id);
        saveLocalState(state);
        setSession(refreshed);
        setSyncNotice(null);
      })
      .catch(() => {
        if (!active) return;
        bindLocalStateOwner(session.user.id);
        saveLocalState(scopedLocal);
        setSyncNotice({
          kind: 'offline-fallback',
          message: 'Ta progression locale est prête. La copie cloud sera reprise lors de la prochaine synchronisation.',
        });
      })
      .finally(() => {
        if (active) setHydrating(false);
      });
    return () => { active = false; };
  }, [launched, cloudEnabled, session?.user.id, recoverySession]);

  async function submitAuth(payload: { mode: 'signin' | 'signup'; email: string; password: string; displayName?: string }) {
    setAuthBusy(true);
    setAuthError(undefined);
    setSyncNotice(null);
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
      saveCloudSession(updated);
      setRecoverySession(null);
      setSession(updated);
      setSyncNotice(null);
    } catch (error) {
      setRecoveryError(error instanceof Error ? error.message : 'Impossible de mettre à jour le mot de passe. Demande un nouveau lien.');
    } finally {
      setRecoveryBusy(false);
    }
  }

  function cancelPasswordReset() {
    if (recoveryBusy) return;
    const restored = loadCloudSession();
    setRecoverySession(null);
    setSession(restored);
    setHydrating(cloudEnabled && Boolean(restored));
    setRecoveryError(undefined);
    setAuthError(undefined);
    setSyncNotice(null);
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
  if (hydrating) {
    return (
      <SafeAreaView style={styles.safe}>
        <View
          style={styles.loading}
          accessibilityRole="progressbar"
          accessibilityLabel="Synchronisation de ton parcours NexCode"
          accessibilityLiveRegion="polite"
        >
          <View style={styles.loadingIndicatorShell}>
            <ActivityIndicator size="small" color={theme.colors.primaryBright} />
          </View>
          <Text style={styles.loadingTitle} accessibilityRole="header">Synchronisation de ton parcours</Text>
          <Text style={styles.loadingMeta}>XP, série, maîtrise et projets sont réunis sur cet appareil.</Text>
        </View>
      </SafeAreaView>
    );
  }
  return (
    <View style={styles.appShell}>
      <NexCodeApp />
      {syncNotice ? (
        <View
          pointerEvents="none"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={styles.syncNotice}
        >
          <View style={styles.syncNoticeIcon}><Text style={styles.syncNoticeIconText}>↻</Text></View>
          <View style={styles.syncNoticeCopy}>
            <Text style={styles.syncNoticeTitle}>Mode local sécurisé</Text>
            <Text style={styles.syncNoticeText}>{syncNotice.message}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  appShell: { flex: 1, backgroundColor: theme.colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  loadingIndicatorShell: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryGlass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderGlass,
  },
  loadingTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '900', marginTop: 18, textAlign: 'center' },
  loadingMeta: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 7, textAlign: 'center', maxWidth: 310 },
  syncNotice: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 13,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderStrong,
    shadowColor: '#000',
    shadowOpacity: .26,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  syncNoticeIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryGlass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderGlass,
  },
  syncNoticeIconText: { color: theme.colors.primaryBright, fontSize: 17, fontWeight: '900' },
  syncNoticeCopy: { flex: 1 },
  syncNoticeTitle: { color: theme.colors.text, fontSize: 12, fontWeight: '900' },
  syncNoticeText: { color: theme.colors.textMuted, fontSize: 10, lineHeight: 15, marginTop: 2 },
});