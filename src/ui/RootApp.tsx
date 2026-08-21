import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import NexCodeApp from './NexCodeApp';
import { LaunchScreen } from './LaunchScreen';
import { AuthScreen } from './AuthScreen';
import { loadLocalState, saveLocalState } from '../lib/localState';
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
  const [hydrating, setHydrating] = useState(() => cloudEnabled && Boolean(loadCloudSession()));
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | undefined>();
  const finishLaunch = useCallback(() => setLaunched(true), []);

  useEffect(() => {
    if (!launched || !cloudEnabled || !session) return;
    let active = true;
    setHydrating(true);
    void pullCloudState(session, loadLocalState())
      .then(({ session: refreshed, state }) => {
        if (!active) return;
        saveCloudSession(refreshed);
        saveLocalState(state);
        setSession(refreshed);
      })
      .catch(() => {
        // Offline-first: an existing account can continue from the local snapshot.
      })
      .finally(() => {
        if (active) setHydrating(false);
      });
    return () => { active = false; };
  }, [launched, cloudEnabled, session?.user.id]);

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

  if (!launched) return <LaunchScreen onDone={finishLaunch} />;
  if (cloudEnabled && !session) return <AuthScreen busy={authBusy} error={authError} onSubmit={submitAuth} />;
  if (hydrating) return <SafeAreaView style={styles.safe}><View style={styles.loading}><ActivityIndicator size="small" color="#8390FF" /><Text style={styles.loadingTitle}>Synchronisation de ton parcours</Text><Text style={styles.loadingMeta}>XP, série, maîtrise et projets sont réunis sur cet appareil.</Text></View></SafeAreaView>;
  return <NexCodeApp />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#070B16' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  loadingTitle: { color: '#F5F7FF', fontSize: 16, fontWeight: '900', marginTop: 18, textAlign: 'center' },
  loadingMeta: { color: '#7B879F', fontSize: 12, lineHeight: 18, marginTop: 7, textAlign: 'center', maxWidth: 310 },
});
