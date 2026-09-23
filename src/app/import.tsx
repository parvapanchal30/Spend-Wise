import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Linking, Platform, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { Screen } from '@/components/Screen';
import { StateNotice } from '@/components/StateNotice';
import type { ReceiptDocument } from '@/domain/models';
import { readTextDocument } from '@/services/documentStorage';
import { createManualExtraction, MAX_RECEIPT_BYTES, OCR_URL, parseReceiptText } from '@/services/receiptExtractor';
import { useSpendWise } from '@/state/AppProvider';
import { colors, radii, spacing } from '@/theme';

type ImportStatus = 'idle' | 'picking' | 'cancelled' | 'permission-denied' | 'failure';

export default function ReceiptImportScreen() {
  const { setPendingExtraction, settings } = useSpendWise();
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [selected, setSelected] = useState<ReceiptDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receiptText, setReceiptText] = useState('');
  const [showText, setShowText] = useState(false);

  function failed(caught: unknown) {
    setStatus('failure');
    setError(caught instanceof Error ? caught.message : 'The receipt could not be opened.');
  }

  async function chooseImage(camera = false) {
    setStatus('picking');
    setError(null);
    try {
      if (camera || Platform.OS !== 'web') {
        const permission = camera
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) { setStatus('permission-denied'); return; }
      }
      const options = { mediaTypes: ['images'] as ImagePicker.MediaType[], allowsEditing: false, quality: 0.85 };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) { setStatus('cancelled'); return; }
      const asset = result.assets[0];
      if (!asset) throw new Error('No image was returned. Please choose it again.');
      if (asset.fileSize && asset.fileSize > MAX_RECEIPT_BYTES) throw new Error('Choose a receipt image smaller than 10 MB.');
      setSelected({ id: `document-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, uri: asset.uri, fileName: asset.fileName ?? undefined, mimeType: asset.mimeType ?? 'image/jpeg', importedAt: new Date().toISOString() });
      setStatus('idle');
    } catch (caught) { failed(caught); }
  }

  function reviewManual() {
    setPendingExtraction(createManualExtraction(selected ?? undefined, settings.defaultCurrency));
    router.push('/review');
  }

  async function importText() {
    setStatus('picking');
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'text/plain', copyToCacheDirectory: true, multiple: false });
      if (result.canceled) { setStatus('cancelled'); return; }
      const asset = result.assets[0];
      if (!asset) throw new Error('No text file was selected.');
      if (asset.size && asset.size > 100_000) throw new Error('Choose a text receipt smaller than 100 KB.');
      const text = await readTextDocument(asset.uri);
      setPendingExtraction(parseReceiptText(text));
      setStatus('idle');
      router.push('/review');
    } catch (caught) { failed(caught); }
  }

  function reviewText() {
    try { setPendingExtraction(parseReceiptText(receiptText)); router.push('/review'); }
    catch (caught) { failed(caught); }
  }

  return (
    <Screen description="Capture a receipt, import a purchase, or enter details yourself." eyebrow="Your purchases" title="Add a transaction">
      {selected ? (
        <View style={styles.previewCard}>
          <Image accessibilityLabel="Selected receipt preview" resizeMode="contain" source={{ uri: selected.uri }} style={styles.preview} />
          <View style={styles.successRow}>
            <Text style={styles.successTitle}>Receipt ready</Text>
            <Text style={styles.fileName} numberOfLines={1}>{selected.fileName || 'Device image'}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.dropArea}>
          <Text style={styles.dropTitle}>Keep the purchase and its proof together</Text>
          <Text style={styles.dropCopy}>Attach a photo to any purchase. Add return and warranty dates after checking the receipt or merchant policy.</Text>
        </View>
      )}
      {status === 'cancelled' ? <StateNotice message="Nothing was imported. Choose another receipt when ready." title="Selection cancelled" /> : null}
      {status === 'permission-denied' ? <StateNotice actionLabel="Open settings" message="Allow camera or photo access in device settings, then try again. Manual entry is always available." onAction={() => void Linking.openSettings()} title="Device permission is required" tone="error" /> : null}
      {status === 'failure' ? <StateNotice message={error ?? 'The receipt could not be opened.'} title="Could not import receipt" tone="error" /> : null}
      <View style={styles.actions}>
        <Button icon="camera-outline" label="Take receipt photo" disabled={status === 'picking'} onPress={() => void chooseImage(true)} />
        <Button icon="images-outline" label={selected ? 'Choose a different image' : 'Choose receipt image'} loading={status === 'picking'} onPress={() => void chooseImage()} variant="secondary" />
        {selected && OCR_URL ? <>
          <StateNotice title="Automatic receipt reading" message={`Choosing “Send and read receipt” sends this image to ${OCR_URL}. Review the extracted details before saving. The service processes the image in memory.`} />
          <Button icon="scan-outline" label="Send and read receipt" onPress={() => router.push({ pathname: '/processing', params: { uri: selected.uri, id: selected.id, importedAt: selected.importedAt, fileName: selected.fileName ?? '', mimeType: selected.mimeType ?? '' } })} />
        </> : selected ? <StateNotice title="Enter the receipt details" message="Your image will be attached to the purchase. Automatic reading is unavailable; manual entry and receipt text import work immediately." /> : null}
        <Button icon="create-outline" label={selected ? 'Enter details with this receipt' : 'Enter purchase manually'} onPress={reviewManual} variant="secondary" />
        <Button icon="document-text-outline" label="Import text receipt" disabled={status === 'picking'} onPress={() => void importText()} variant="secondary" />
        <Button label={showText ? 'Hide receipt text' : 'Paste receipt text'} onPress={() => setShowText(!showText)} variant="ghost" />
      </View>
      {showText ? <View style={styles.actions}>
        <FormField label="Receipt text" hint="Paste the full receipt. Unclear or missing details stay blank for your review." multiline numberOfLines={8} maxLength={100_000} onChangeText={setReceiptText} value={receiptText} style={styles.textArea} />
        <Button label="Review receipt text" disabled={!receiptText.trim()} onPress={reviewText} />
      </View> : null}
      <Button label="Cancel" onPress={() => router.back()} variant="ghost" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  previewCard: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  preview: { width: '100%', height: 320, backgroundColor: colors.surfaceMuted },
  successRow: { padding: spacing.lg, gap: spacing.xs },
  successTitle: { color: colors.accent, fontSize: 15, fontWeight: '800' },
  fileName: { color: colors.textMuted, fontSize: 13 },
  dropArea: { minHeight: 170, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, borderRadius: radii.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.surface, gap: spacing.sm },
  dropTitle: { color: colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  dropCopy: { color: colors.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  actions: { gap: spacing.sm },
  textArea: { minHeight: 180, paddingVertical: spacing.md, textAlignVertical: 'top' },
});
