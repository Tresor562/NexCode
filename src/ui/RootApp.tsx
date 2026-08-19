import React, { useCallback, useState } from 'react';
import NexCodeApp from './NexCodeApp';
import { LaunchScreen } from './LaunchScreen';

export default function RootApp() {
  const [launched, setLaunched] = useState(false);
  const finishLaunch = useCallback(() => setLaunched(true), []);
  if (!launched) return <LaunchScreen onDone={finishLaunch} />;
  return <NexCodeApp />;
}
