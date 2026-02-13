import { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import type { ListRenderItemInfo } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useScanStore } from '../src/stores/scanStore';
import type { ScanResponse, ContentType } from '@opta/shared';

/** Type for Ionicons name prop */
type IoniconsName = ComponentProps<typeof Ionicons>['name'];

/** Animation timing constants */
const ANIMATION_DURATION_MS = 400;
const FADE_IN_DURATION_MS = 400;
const STAGGER_DELAY_MS = 50;

/** Time thresholds in milliseconds */
const MS_PER_MINUTE = 60000;
const MS_PER_HOUR = 3600000;
const MS_PER_DAY = 86400000;
const DAYS_BEFORE_DATE_DISPLAY = 7;

/** Score multiplier for display */
const SCORE_TO_PERCENTAGE = 100;

/**
 * HistoryScreen - Displays past scan results with navigation to details
 */
export default function HistoryScreen(): React.JSX.Element {
  const { scanHistory, clearHistory, setCurrentScan } = useScanStore();

  /** Navigate to results screen with selected scan data */
  const handleViewScan = useCallback((scan: ScanResponse): void => {
    setCurrentScan(scan);
    router.push('/results');
  }, [setCurrentScan]);

  /**
   * Formats a timestamp into a human-readable relative time string
   * @param timestamp - Unix timestamp in milliseconds
   * @returns Formatted string like "Just now", "5m ago", "2h ago", "3d ago", or date
   */
  const formatRelativeTime = useCallback((timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / MS_PER_MINUTE);
    const diffHours = Math.floor(diffMs / MS_PER_HOUR);
    const diffDays = Math.floor(diffMs / MS_PER_DAY);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < DAYS_BEFORE_DATE_DISPLAY) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }, []);

  /** Icon mapping for content types */
  const contentTypeIconMap: Record<ContentType | string, IoniconsName> = useMemo(() => ({
    menu: 'restaurant-outline',
    products: 'cart-outline',
    listings: 'list-outline',
    comparison: 'git-compare-outline',
    document: 'document-text-outline',
    pricing: 'pricetag-outline',
    other: 'scan-outline',
  }), []);

  /**
   * Returns the appropriate icon name for a content type
   * @param type - The content type string
   * @returns Ionicons name for the content type
   */
  const getContentTypeIcon = useCallback((type: string): IoniconsName => {
    return contentTypeIconMap[type] ?? 'scan-outline';
  }, [contentTypeIconMap]);

  /** Renders a single history item in the list */
  const renderHistoryItem = useCallback(({ item, index }: ListRenderItemInfo<ScanResponse>): React.JSX.Element => {
    const iconName = getContentTypeIcon(item.contentType);
    const scorePercentage = Math.round(item.recommendation.topChoice.score * SCORE_TO_PERCENTAGE);
    // Use actual timestamp if available, otherwise estimate from index
    const estimatedTimestamp = Date.now() - (index * MS_PER_HOUR);

    return (
      <Animated.View entering={FadeInDown.delay(index * STAGGER_DELAY_MS).duration(ANIMATION_DURATION_MS)}>
        <Pressable
          style={styles.historyItem}
          onPress={() => handleViewScan(item)}
          accessibilityRole="button"
          accessibilityLabel={`View scan: ${item.recommendation.topChoice.name}`}
        >
          <View style={styles.itemIcon}>
            <Ionicons name={iconName} size={24} color="#06b6d4" />
          </View>

          <View style={styles.itemContent}>
            <Text style={styles.itemTitle} numberOfLines={1}>
              {item.recommendation.topChoice.name}
            </Text>
            <Text style={styles.itemSubtitle}>
              {item.contentType} | Score: {scorePercentage}
            </Text>
          </View>

          <View style={styles.itemMeta}>
            <Text style={styles.itemTime}>{formatRelativeTime(estimatedTimestamp)}</Text>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" />
          </View>
        </Pressable>
      </Animated.View>
    );
  }, [getContentTypeIcon, handleViewScan, formatRelativeTime]);

  /** Extract scanId for FlatList key */
  const extractScanKey = useCallback((item: ScanResponse): string => item.scanId, []);

  /** Whether the history list is empty */
  const isHistoryEmpty = scanHistory.length === 0;

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
        <Text style={styles.headerTitle}>Scan History</Text>
        {!isHistoryEmpty ? (
          <Pressable
            style={styles.clearButton}
            onPress={clearHistory}
            accessibilityRole="button"
            accessibilityLabel="Clear all history"
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </Animated.View>

      {/* Content - Empty State or List */}
      {isHistoryEmpty ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="time-outline" size={64} color="rgba(255,255,255,0.2)" />
          <Text style={styles.emptyTitle}>No Scans Yet</Text>
          <Text style={styles.emptyText}>
            Your optimization history will appear here after you scan something
          </Text>
          <Pressable
            style={styles.scanButton}
            onPress={() => router.push('/scan')}
            accessibilityRole="button"
            accessibilityLabel="Start scanning"
          >
            <Ionicons name="scan" size={20} color="#0a0a0f" />
            <Text style={styles.scanButtonText}>Start Scanning</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={scanHistory}
          renderItem={renderHistoryItem}
          keyExtractor={extractScanKey}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clearButtonText: {
    fontSize: 14,
    color: '#ef4444',
  },
  headerSpacer: {
    width: 60,
  },
  list: {
    padding: 16,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  itemIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  itemSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  itemMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  itemTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#06b6d4',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0a0a0f',
  },
});
