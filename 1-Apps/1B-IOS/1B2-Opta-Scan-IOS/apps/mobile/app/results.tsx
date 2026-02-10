import { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useScanStore } from '../src/stores/scanStore';
import type { ScoredOption } from '@opta/shared';

/** Type for Ionicons name prop */
type IoniconsName = ComponentProps<typeof Ionicons>['name'];

/** Animation timing constants */
const ANIMATION_DURATION_MS = 500;
const FADE_IN_DURATION_MS = 400;
const STAGGER_DELAY_MS = 100;

/** Maximum number of alternative options to display */
const MAX_ALTERNATIVES_SHOWN = 3;

/** Score multiplier to convert 0-1 scores to percentage */
const SCORE_TO_PERCENTAGE = 100;

/**
 * ResultsScreen - Displays optimization analysis results
 * Shows top recommendation, score breakdown, and alternatives
 */
export default function ResultsScreen(): React.JSX.Element {
  const { currentScan, isLoading, error, reset } = useScanStore();

  /** Navigate to scan screen for a new scan */
  const handleNewScan = useCallback((): void => {
    reset();
    router.replace('/scan');
  }, [reset]);

  /** Navigate back to home screen */
  const handleGoHome = useCallback((): void => {
    reset();
    router.replace('/');
  }, [reset]);

  // Loading state - API processing in progress
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#06b6d4" />
          <Text style={styles.loadingText}>Analyzing your options...</Text>
          <Text style={styles.loadingSubtext}>Finding the optimal choice</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state - scan or API failed
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text style={styles.errorTitle}>Analysis Failed</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={handleNewScan}
            accessibilityRole="button"
            accessibilityLabel="Try scanning again"
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // No data state - user navigated here without scanning
  if (!currentScan) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="scan-outline" size={64} color="#06b6d4" />
          <Text style={styles.errorTitle}>No Scan Data</Text>
          <Text style={styles.errorText}>Take a photo to get started</Text>
          <Pressable
            style={styles.retryButton}
            onPress={handleNewScan}
            accessibilityRole="button"
            accessibilityLabel="Start scanning"
          >
            <Text style={styles.retryButtonText}>Start Scanning</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const { recommendation, allOptions, contentType, confidence, processingTimeMs } = currentScan;
  const { topChoice } = recommendation;
  const alternatives = allOptions
    .filter((opt): boolean => opt.id !== topChoice.id)
    .slice(0, MAX_ALTERNATIVES_SHOWN);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Navigation */}
      <Animated.View entering={FadeIn.duration(FADE_IN_DURATION_MS)} style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={handleGoHome}
          accessibilityRole="button"
          accessibilityLabel="Close and go home"
        >
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Your Optimal Choice</Text>
        <View style={styles.headerSpacer} />
      </Animated.View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Top Recommendation Card */}
        <Animated.View entering={FadeInDown.delay(STAGGER_DELAY_MS).duration(ANIMATION_DURATION_MS)} style={styles.topCard}>
          <View style={styles.badge}>
            <Ionicons name="trophy" size={16} color="#0a0a0f" />
            <Text style={styles.badgeText}>BEST MATCH</Text>
          </View>

          <Text style={styles.topName}>{topChoice.name}</Text>

          {topChoice.description != null && topChoice.description.length > 0 && (
            <Text style={styles.topDescription}>{topChoice.description}</Text>
          )}

          <View style={styles.scoreContainer}>
            <View style={styles.scoreCircle} accessibilityLabel={`Score: ${Math.round(topChoice.score * SCORE_TO_PERCENTAGE)}`}>
              <Text style={styles.scoreValue}>{Math.round(topChoice.score * SCORE_TO_PERCENTAGE)}</Text>
              <Text style={styles.scoreLabel}>Score</Text>
            </View>
          </View>

          {/* Score Breakdown by Category */}
          <View style={styles.breakdown}>
            {topChoice.scoreBreakdown != null && (
              <>
                <ScoreBar label="Budget" value={topChoice.scoreBreakdown.budget ?? 0} icon="wallet-outline" />
                <ScoreBar label="Quality" value={topChoice.scoreBreakdown.quality ?? 0} icon="star-outline" />
                <ScoreBar label="Health" value={topChoice.scoreBreakdown.health ?? 0} icon="heart-outline" />
                <ScoreBar label="Time" value={topChoice.scoreBreakdown.time ?? 0} icon="time-outline" />
                <ScoreBar label="Eco" value={topChoice.scoreBreakdown.sustainability ?? 0} icon="leaf-outline" />
              </>
            )}
          </View>
        </Animated.View>

        {/* AI Explanation */}
        <Animated.View entering={FadeInDown.delay(STAGGER_DELAY_MS * 2).duration(ANIMATION_DURATION_MS)} style={styles.explanationCard}>
          <Ionicons name="bulb-outline" size={20} color="#06b6d4" />
          <Text style={styles.explanationText}>{recommendation.explanation}</Text>
        </Animated.View>

        {/* Alternative Options */}
        {alternatives.length > 0 && (
          <Animated.View entering={FadeInDown.delay(STAGGER_DELAY_MS * 3).duration(ANIMATION_DURATION_MS)}>
            <Text style={styles.sectionTitle}>Other Options</Text>
            {alternatives.map((option, index) => (
              <AlternativeCard key={option.id} option={option} rank={index + 2} />
            ))}
          </Animated.View>
        )}

        {/* Scan Metadata */}
        <Animated.View entering={FadeInUp.delay(STAGGER_DELAY_MS * 4).duration(ANIMATION_DURATION_MS)} style={styles.metadata}>
          <Text style={styles.metadataText}>
            {contentType} | {Math.round(confidence)}% confident | {processingTimeMs}ms
          </Text>
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View entering={FadeInUp.delay(STAGGER_DELAY_MS * 5).duration(ANIMATION_DURATION_MS)} style={styles.actions}>
          <Pressable
            style={styles.primaryButton}
            onPress={handleNewScan}
            accessibilityRole="button"
            accessibilityLabel="Scan again"
          >
            <Ionicons name="scan" size={20} color="#0a0a0f" />
            <Text style={styles.primaryButtonText}>Scan Again</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={handleGoHome}
            accessibilityRole="button"
            accessibilityLabel="Done, go home"
          >
            <Text style={styles.secondaryButtonText}>Done</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Props for ScoreBar component */
interface ScoreBarProps {
  readonly label: string;
  readonly value: number;
  readonly icon: IoniconsName;
}

/**
 * ScoreBar - Displays a labeled progress bar for a score category
 */
function ScoreBar({ label, value, icon }: ScoreBarProps): React.JSX.Element {
  const percentageValue = Math.round(value * SCORE_TO_PERCENTAGE);
  const widthPercentage = `${percentageValue}%` as const;

  return (
    <View style={styles.scoreBar} accessibilityLabel={`${label}: ${percentageValue} percent`}>
      <Ionicons name={icon} size={16} color="rgba(255,255,255,0.5)" />
      <Text style={styles.scoreBarLabel}>{label}</Text>
      <View style={styles.scoreBarTrack}>
        <View style={[styles.scoreBarFill, { width: widthPercentage }]} />
      </View>
      <Text style={styles.scoreBarValue}>{percentageValue}</Text>
    </View>
  );
}

/** Props for AlternativeCard component */
interface AlternativeCardProps {
  readonly option: ScoredOption;
  readonly rank: number;
}

/**
 * AlternativeCard - Displays a compact card for alternative options
 */
function AlternativeCard({ option, rank }: AlternativeCardProps): React.JSX.Element {
  const scorePercentage = Math.round(option.score * SCORE_TO_PERCENTAGE);

  return (
    <View style={styles.alternativeCard} accessibilityLabel={`Rank ${rank}: ${option.name}, score ${scorePercentage}`}>
      <View style={styles.altRank}>
        <Text style={styles.altRankText}>#{rank}</Text>
      </View>
      <View style={styles.altContent}>
        <Text style={styles.altName}>{option.name}</Text>
        {option.description != null && option.description.length > 0 && (
          <Text style={styles.altDescription} numberOfLines={1}>
            {option.description}
          </Text>
        )}
      </View>
      <View style={styles.altScore}>
        <Text style={styles.altScoreValue}>{scorePercentage}</Text>
      </View>
    </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 24,
  },
  loadingSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#06b6d4',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0a0a0f',
  },
  topCard: {
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#06b6d4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    gap: 6,
    marginBottom: 16,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0a0a0f',
    letterSpacing: 0.5,
  },
  topName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  topDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 20,
  },
  scoreContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  scoreCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    borderWidth: 3,
    borderColor: '#06b6d4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#06b6d4',
  },
  scoreLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  breakdown: {
    gap: 12,
  },
  scoreBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreBarLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    width: 50,
  },
  scoreBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    backgroundColor: '#06b6d4',
    borderRadius: 3,
  },
  scoreBarValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    width: 30,
    textAlign: 'right',
  },
  explanationCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 24,
  },
  explanationText: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  alternativeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  altRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  altRankText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  altContent: {
    flex: 1,
  },
  altName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  altDescription: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  altScore: {
    marginLeft: 12,
  },
  altScoreValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#06b6d4',
  },
  metadata: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  metadataText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
  },
  actions: {
    gap: 12,
    paddingBottom: 32,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#06b6d4',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0a0a0f',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  secondaryButtonText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
  },
});
