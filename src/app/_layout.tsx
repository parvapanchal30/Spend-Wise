import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider } from '@/state/AppProvider';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: colors.background },
            headerBackTitle: 'Back',
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="import" options={{ title: 'Import receipt' }} />
          <Stack.Screen name="processing" options={{ headerShown: false }} />
          <Stack.Screen name="review" options={{ title: 'Review transaction' }} />
          <Stack.Screen name="transaction/[id]" options={{ title: 'Transaction details' }} />
        </Stack>
      </AppProvider>
    </SafeAreaProvider>
  );
}
