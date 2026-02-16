import { Stack } from 'expo-router/stack';
import { PlatformColor } from 'react-native';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: '#007AFF',
        headerTitleStyle: { color: PlatformColor('label') },
        headerBackButtonDisplayMode: 'minimal',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#F8F8FA' },
      }}
    />
  );
}
