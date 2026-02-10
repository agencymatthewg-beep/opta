import { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { useScanStore } from '../src/stores/scanStore';
import type { PriorityWeights } from '@opta/shared';

/** Type for Ionicons name prop */
type IoniconsName = ComponentProps<typeof Ionicons>['name'];

/** Animation timing constants */
const ANIMATION_DURATION_MS = 500;
const FADE_IN_DURATION_MS = 400;
const STAGGER_DELAY_MS = 50;
const BASE_DELAY_MS = 150;

/** Slider configuration */
const SLIDER_MIN = 0;
const SLIDER_MAX = 1;
const SLIDER_STEP = 0.05;

/** Score display multiplier */
const SCORE_TO_PERCENTAGE = 100;

/** Priority configuration metadata */
interface PriorityConfig {
  readonly label: string;
  readonly icon: IoniconsName;
  readonly color: string;
  readonly description: string;
}

/** Configuration for all priority categories */
const PRIORITY_INFO: Readonly<Record<keyof PriorityWeights, PriorityConfig>> = {
  budget: {
    label: 'Budget',
    icon: 'wallet-outline',
    color: '#22c55e',
    description: 'Prioritize cost-effective options',
  },
  health: {
    label: 'Health',
    icon: 'heart-outline',
    color: '#ef4444',
    description: 'Favor healthier choices',
  },
  quality: {
    label: 'Quality',
    icon: 'star-outline',
    color: '#f59e0b',
    description: 'Emphasize premium quality',
  },
  time: {
    label: 'Time',
    icon: 'time-outline',
    color: '#8b5cf6',
    description: 'Prefer faster options',
  },
  sustainability: {
    label: 'Sustainability',
    icon: 'leaf-outline',
    color: '#06b6d4',
    description: 'Choose eco-friendly options',
  },
} as const;

/** Default priority weights */
const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  budget: 0.3,
  health: 0.2,
  quality: 0.3,
  time: 0.1,
  sustainability: 0.1,
} as const;

/**
 * SettingsScreen - User preferences and priority configuration
 * Allows adjustment of optimization weights and data management
 */
export default function SettingsScreen(): React.JSX.Element {
  const { priorities, setPriorities, clearHistory, scanHistory } = useScanStore();
  const [localPriorities, setLocalPriorities] = useState<PriorityWeights>({ ...priorities });

  /** List of priority keys for iteration */
  const priorityKeys = useMemo((): Array<keyof PriorityWeights> =>
    Object.keys(PRIORITY_INFO) as Array<keyof PriorityWeights>,
    []
  );

  /** Whether history is empty */
  const isHistoryEmpty = scanHistory.length === 0;

  /** Handle real-time slider value change (UI only) */
  const handleSliderChange = useCallback((key: keyof PriorityWeights, value: number): void => {
    setLocalPriorities((prev) => ({ ...prev, [key]: value }));
  }, []);

  /** Handle slider release - persist the value with haptic feedback */
  const handleSliderComplete = useCallback(async (key: keyof PriorityWeights, value: number): Promise<void> => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPriorities({ [key]: value });
  }, [setPriorities]);

  /** Reset all priorities to default values */
  const resetToDefaults = useCallback(async (): Promise<void> => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLocalPriorities({ ...DEFAULT_PRIORITY_WEIGHTS });
    setPriorities({ ...DEFAULT_PRIORITY_WEIGHTS });
  }, [setPriorities]);

  /** Clear scan history with haptic feedback */
  const handleClearHistory = useCallback(async (): Promise<void> => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    clearHistory();
  }, [clearHistory]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Navigation */}
      <Animated.View entering={FadeIn.duration(FADE_IN_DURATION_MS)} style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </Animated.View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Priorities Section */}
        <Animated.View entering={FadeInDown.delay(100).duration(ANIMATION_DURATION_MS)}>
          <Text style={styles.sectionTitle}>Optimization Priorities</Text>
          <Text style={styles.sectionSubtitle}>
            Adjust how much each factor influences your recommendations
          </Text>

          <View style={styles.prioritiesCard}>
            {priorityKeys.map((key, index) => {
              const info = PRIORITY_INFO[key];
              const value = localPriorities[key] ?? 0;
              const percentageValue = Math.round(value * SCORE_TO_PERCENTAGE);
              const iconBackgroundColor = `${info.color}20`;

              return (
                <Animated.View
                  key={key}
                  entering={FadeInDown.delay(BASE_DELAY_MS + index * STAGGER_DELAY_MS).duration(ANIMATION_DURATION_MS)}
                  style={styles.priorityItem}
                >
                  <View style={styles.priorityHeader}>
                    <View style={styles.priorityLabel}>
                      <View style={[styles.priorityIcon, { backgroundColor: iconBackgroundColor }]}>
                        <Ionicons name={info.icon} size={18} color={info.color} />
                      </View>
                      <View>
                        <Text style={styles.priorityName}>{info.label}</Text>
                        <Text style={styles.priorityDescription}>{info.description}</Text>
                      </View>
                    </View>
                    <Text style={[styles.priorityValue, { color: info.color }]}>
                      {percentageValue}%
                    </Text>
                  </View>

                  <Slider
                    style={styles.slider}
                    value={value}
                    minimumValue={SLIDER_MIN}
                    maximumValue={SLIDER_MAX}
                    step={SLIDER_STEP}
                    minimumTrackTintColor={info.color}
                    maximumTrackTintColor="rgba(255,255,255,0.1)"
                    thumbTintColor={info.color}
                    onValueChange={(v: number) => handleSliderChange(key, v)}
                    onSlidingComplete={(v: number) => handleSliderComplete(key, v)}
                    accessibilityLabel={`${info.label} priority: ${percentageValue} percent`}
                  />
                </Animated.View>
              );
            })}
          </View>

          <Pressable
            style={styles.resetButton}
            onPress={resetToDefaults}
            accessibilityRole="button"
            accessibilityLabel="Reset priorities to defaults"
          >
            <Ionicons name="refresh-outline" size={18} color="#06b6d4" />
            <Text style={styles.resetButtonText}>Reset to Defaults</Text>
          </Pressable>
        </Animated.View>

        {/* Data Management Section */}
        <Animated.View entering={FadeInDown.delay(400).duration(ANIMATION_DURATION_MS)} style={styles.section}>
          <Text style={styles.sectionTitle}>Data</Text>

          <View style={styles.dataCard}>
            <View style={styles.dataRow}>
              <View style={styles.dataInfo}>
                <Ionicons name="time-outline" size={20} color="rgba(255,255,255,0.5)" />
                <Text style={styles.dataLabel}>Scan History</Text>
              </View>
              <Text style={styles.dataValue}>{scanHistory.length} scans</Text>
            </View>

            <Pressable
              style={[styles.clearButton, isHistoryEmpty && styles.clearButtonDisabled]}
              onPress={handleClearHistory}
              disabled={isHistoryEmpty}
              accessibilityRole="button"
              accessibilityLabel="Clear scan history"
              accessibilityState={{ disabled: isHistoryEmpty }}
            >
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
              <Text style={styles.clearButtonText}>Clear History</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* About Section */}
        <Animated.View entering={FadeInDown.delay(500).duration(ANIMATION_DURATION_MS)} style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>

          <View style={styles.aboutCard}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>Opta</Text>
              <Text style={styles.versionText}>v0.1.0</Text>
            </View>
            <Text style={styles.aboutText}>
              Scan Anything. Optimize Everything.
            </Text>
            <Text style={styles.copyrightText}>
              Built with AI to help you make optimal decisions
            </Text>
          </View>
        </Animated.View>

        {/* Bottom spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginTop: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 16,
  },
  prioritiesCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
  },
  priorityItem: {
    marginBottom: 20,
  },
  priorityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  priorityLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priorityIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  priorityName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  priorityDescription: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  priorityValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    marginTop: 8,
  },
  resetButtonText: {
    fontSize: 14,
    color: '#06b6d4',
    fontWeight: '500',
  },
  dataCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dataInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dataLabel: {
    fontSize: 15,
    color: '#fff',
  },
  dataValue: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    gap: 8,
  },
  clearButtonDisabled: {
    opacity: 0.4,
  },
  clearButtonText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '500',
  },
  aboutCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginTop: 12,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 8,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#06b6d4',
  },
  versionText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
  },
  aboutText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
  },
  copyrightText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
  },
  bottomSpacer: {
    height: 40,
  },
});
