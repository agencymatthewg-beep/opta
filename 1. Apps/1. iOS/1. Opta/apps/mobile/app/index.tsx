import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

/** Animation timing constants for consistent UX */
const ANIMATION_DURATION_MS = 500;
const FADE_IN_DURATION_MS = 600;
const STAGGER_DELAY_MS = 200;

/**
 * HomeScreen - Main landing screen for Opta Mobile
 * Displays branding, primary scan CTA, and quick navigation actions
 */
export default function HomeScreen(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      {/* Brand Header */}
      <Animated.View entering={FadeIn.duration(FADE_IN_DURATION_MS)} style={styles.header}>
        <Text style={styles.logo}>Opta</Text>
        <Text style={styles.tagline}>Scan Anything. Optimize Everything.</Text>
      </Animated.View>

      <View style={styles.content}>
        {/* Primary CTA - Scan Button */}
        <Animated.View entering={FadeInDown.delay(STAGGER_DELAY_MS).duration(ANIMATION_DURATION_MS)}>
          <Link href="/scan" asChild>
            <Pressable style={styles.scanButton} accessibilityRole="button" accessibilityLabel="Start scanning">
              <View style={styles.scanIconContainer}>
                <Ionicons name="scan" size={48} color="#0a0a0f" />
              </View>
              <Text style={styles.scanButtonText}>Start Scanning</Text>
              <Text style={styles.scanButtonSubtext}>
                Point at anything to optimize
              </Text>
            </Pressable>
          </Link>
        </Animated.View>

        {/* Quick Navigation Actions */}
        <Animated.View
          entering={FadeInDown.delay(STAGGER_DELAY_MS * 2).duration(ANIMATION_DURATION_MS)}
          style={styles.quickActions}
        >
          <Link href="/history" asChild>
            <Pressable style={styles.quickAction} accessibilityRole="button" accessibilityLabel="View scan history">
              <Ionicons name="time-outline" size={24} color="#06b6d4" />
              <Text style={styles.quickActionText}>History</Text>
            </Pressable>
          </Link>

          <Link href="/settings" asChild>
            <Pressable style={styles.quickAction} accessibilityRole="button" accessibilityLabel="Open settings">
              <Ionicons name="settings-outline" size={24} color="#06b6d4" />
              <Text style={styles.quickActionText}>Settings</Text>
            </Pressable>
          </Link>
        </Animated.View>
      </View>

      {/* Footer Tip */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Tip: Scan menus, products, listings - anything!</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
  },
  logo: {
    fontSize: 48,
    fontWeight: '700',
    color: '#06b6d4',
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  scanButton: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
  },
  scanIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#06b6d4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  scanButtonText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  scanButtonSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 32,
  },
  quickAction: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickActionText: {
    fontSize: 16,
    color: '#fff',
  },
  footer: {
    paddingBottom: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
  },
});
