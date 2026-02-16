import { Stack } from 'expo-router/stack';
import { Provider, useSelector } from 'react-redux';
import { store, RootState } from '../src/store';
import { useEffect } from 'react';
import { router, useSegments } from 'expo-router';

function AuthGate({ children }: { children: React.ReactNode }) {
  const token = useSelector((state: RootState) => state.auth.token);
  const segments = useSegments();

  useEffect(() => {
    const inAuth = segments[0] === '(auth)';
    if (!token && !inAuth) {
      router.replace('/(auth)/login');
    } else if (token && inAuth) {
      router.replace('/(app)');
    }
  }, [token, segments]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <AuthGate>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthGate>
    </Provider>
  );
}
