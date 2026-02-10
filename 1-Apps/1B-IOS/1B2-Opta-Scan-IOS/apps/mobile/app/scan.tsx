import { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import type { CameraView as CameraViewType } from 'expo-camera';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import { useScanStore } from '../src/stores/scanStore';
import { scanImage } from '../src/services/api';

/** Optimal image width for GPT-4 Vision processing */
const OPTIMAL_IMAGE_WIDTH = 1568;
/** JPEG compression quality for upload */
const IMAGE_COMPRESSION_QUALITY = 0.85;
/** Camera photo capture quality */
const PHOTO_CAPTURE_QUALITY = 0.8;

/**
 * ScanScreen - Camera interface for capturing images to analyze
 * Handles camera permissions, photo capture, and API submission
 */
export default function ScanScreen(): React.JSX.Element {
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const cameraRef = useRef<CameraViewType>(null);
  const { setCurrentScan, setLoading, setError } = useScanStore();

  // Request camera permission on mount if not already granted
  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  /**
   * Captures photo, compresses it, and submits to API for analysis
   */
  const handleCapture = useCallback(async (): Promise<void> => {
    if (!cameraRef.current || isCapturing) return;

    setIsCapturing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Capture photo from camera
      const photo = await cameraRef.current.takePictureAsync({
        quality: PHOTO_CAPTURE_QUALITY,
        base64: true,
      });

      if (!photo?.base64) {
        throw new Error('Failed to capture photo - no base64 data returned');
      }

      // Compress and resize image for optimal API processing
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: OPTIMAL_IMAGE_WIDTH } }],
        {
          compress: IMAGE_COMPRESSION_QUALITY,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true
        }
      );

      if (!manipulatedImage.base64) {
        throw new Error('Image manipulation failed - no base64 data');
      }

      // Navigate to results screen with loading state
      setLoading(true);
      router.push('/results');

      // Submit to scan API
      const result = await scanImage(manipulatedImage.base64);

      if (result.success) {
        setCurrentScan(result);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        const errorMessage = result.error ?? 'Scan failed';
        setError(errorMessage);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Capture error:', errorMessage);
      setError('Failed to process image. Please try again.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsCapturing(false);
      setLoading(false);
    }
  }, [isCapturing, setCurrentScan, setLoading, setError]);

  // Loading state while checking permissions
  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
    );
  }

  // Permission denied - show request UI
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color="#06b6d4" />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            Opta needs camera access to scan and optimize your decisions.
          </Text>
          <Pressable
            style={styles.permissionButton}
            onPress={requestPermission}
            accessibilityRole="button"
            accessibilityLabel="Grant camera permission"
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
      >
        {/* Header Navigation */}
        <SafeAreaView style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>Scan to Optimize</Text>
          <View style={styles.headerSpacer} />
        </SafeAreaView>

        {/* Scan Frame Overlay */}
        <View style={styles.frameContainer}>
          <View style={styles.frame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <Text style={styles.frameHint}>
            Point at menus, products, or any options
          </Text>
        </View>

        {/* Capture Button */}
        <SafeAreaView style={styles.footer}>
          <Pressable
            style={[styles.captureButton, isCapturing && styles.captureButtonDisabled]}
            onPress={handleCapture}
            disabled={isCapturing}
            accessibilityRole="button"
            accessibilityLabel={isCapturing ? 'Capturing photo' : 'Capture photo'}
            accessibilityState={{ disabled: isCapturing }}
          >
            {isCapturing ? (
              <ActivityIndicator size="large" color="#0a0a0f" />
            ) : (
              <View style={styles.captureInner} />
            )}
          </Pressable>
        </SafeAreaView>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  camera: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
  frameContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frame: {
    width: 280,
    height: 280,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#06b6d4',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  frameHint: {
    marginTop: 24,
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 32,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#06b6d4',
  },
  captureButtonDisabled: {
    opacity: 0.7,
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#06b6d4',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    marginTop: 24,
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: '#06b6d4',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0a0a0f',
  },
});
