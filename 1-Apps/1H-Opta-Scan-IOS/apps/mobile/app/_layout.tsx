import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/** App theme background color */
const BACKGROUND_COLOR = '#0a0a0f';

/** Default navigation animation style */
const DEFAULT_ANIMATION = 'slide_from_right' as const;

/** React Query client configuration */
const queryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 2,
    },
  },
} as const;

/**
 * RootLayout - Main application layout wrapper
 * Provides navigation, query client, gestures, and safe area context
 */
export default function RootLayout(): React.JSX.Element {
  // Memoize QueryClient to prevent recreation on re-renders
  const queryClient = useMemo(() => new QueryClient(queryClientConfig), []);

  /** Navigation screen options */
  const screenOptions: NativeStackNavigationOptions = useMemo(() => ({
    headerShown: false,
    contentStyle: styles.screenContent,
    animation: DEFAULT_ANIMATION,
  }), []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <GestureHandlerRootView style={styles.gestureRoot}>
          <StatusBar style="light" />
          <Stack screenOptions={screenOptions}>
            <Stack.Screen name="index" />
            <Stack.Screen name="scan" />
            <Stack.Screen name="results" />
            <Stack.Screen name="history" />
            <Stack.Screen name="settings" />
          </Stack>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  screenContent: {
    backgroundColor: BACKGROUND_COLOR,
  },
});
