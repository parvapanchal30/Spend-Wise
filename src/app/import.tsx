import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { StateNotice } from '@/components/StateNotice';
import { colors, radii, spacing } from '@/theme';

type ImportStatus = 'idle' | 'picking' | 'selected' | 'cancelled' | 'permission-denied' | 'failure';

interface SelectedImage {
  uri: string;
  fileName?: string;
  mimeType?: string;
}

export default function ReceiptImportScreen() {
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function chooseImage() {
    setStatus('picking');
    setError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setStatus('permission-denied');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.85,
      });

      if (result.canceled) {
        setStatus('cancelled');
        return;
      }

      const asset = result.assets[0];
      if (!asset) {
        throw new Error('No image was returned by the device picker.');
      }

      setSelectedImage({
        uri: asset.uri,
        fileName: asset.fileName ?? undefined,
        mimeType: asset.mimeType ?? undefined,
      });
      setStatus('selected');
    } catch (caughtError) {
      setStatus('failure');
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'The receipt image could not be selected.',
      );
    }
  }

  function processSelectedImage() {
    if (!selectedImage) return;
    router.push({
      pathname: '/processing',
      params: {
        uri: selectedImage.uri,
        fileName: selectedImage.fileName ?? '',
        mimeType: selectedImage.mimeType ?? '',
      },
    });
  }

  return (
    <Screen
      description="Choose a clear receipt, invoice, or purchase screenshot from this device."
      eyebrow="Local prototype"
      title="Import receipt"
    >
      {selectedImage ? (
        <View style={styles.previewCard}>
          <Image
            accessibilityLabel="Selected receipt preview"
            resizeMode="contain"
            source={{ uri: selectedImage.uri }}
            style={styles.preview}
          />
          <View style={styles.successRow}>
            <Text style={styles.successTitle}>Image ready</Text>
            <Text style={styles.fileName} numberOfLines={1}>
              {selectedImage.fileName || 'Device image'}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.dropArea}>
          <Text style={styles.dropTitle}>Your receipt stays on this device</Text>
          <Text style={styles.dropCopy}>
            This milestone does not upload images or call an AI service.
          </Text>
        </View>
      )}

      {status === 'cancelled' ? (
        <StateNotice message="Nothing was imported. You can choose another image when ready." title="Selection cancelled" />
      ) : null}
      {status === 'permission-denied' ? (
        <StateNotice
          actionLabel="Open settings"
          message="Allow photo access in device settings, then return to SpendWise and try again."
          onAction={() => void Linking.openSettings()}
          title="Photo access is required"
          tone="error"
        />
      ) : null}
      {status === 'failure' ? (
        <StateNotice
          actionLabel="Try again"
          message={error ?? 'The image picker failed.'}
          onAction={() => void chooseImage()}
          title="Could not import image"
          tone="error"
        />
      ) : null}

      <View style={styles.actions}>
        <Button
          accessibilityLabel={selectedImage ? 'Choose a different receipt image' : 'Choose receipt image'}
          icon="images-outline"
          label={selectedImage ? 'Choose a different image' : 'Choose image from device'}
          loading={status === 'picking'}
          onPress={() => void chooseImage()}
          variant={selectedImage ? 'secondary' : 'primary'}
        />
        {selectedImage ? (
          <Button icon="sparkles-outline" label="Process locally" onPress={processSelectedImage} />
        ) : null}
        <Button label="Cancel" onPress={() => router.back()} variant="ghost" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  previewCard: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  preview: { width: '100%', height: 320, backgroundColor: colors.surfaceMuted },
  successRow: { padding: spacing.lg, gap: spacing.xs },
  successTitle: { color: colors.accent, fontSize: 15, fontWeight: '800' },
  fileName: { color: colors.textMuted, fontSize: 13 },
  dropArea: { minHeight: 230, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, borderRadius: radii.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.surface, gap: spacing.sm },
  dropTitle: { color: colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  dropCopy: { color: colors.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  actions: { gap: spacing.sm },
});
