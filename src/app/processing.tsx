import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import type { ReceiptDocument } from '@/domain/models';
import { services } from '@/services/serviceContainer';
import { useSpendWise } from '@/state/AppProvider';
import { colors, radii, spacing } from '@/theme';

type ProcessStatus = 'processing' | 'failure';

export default function ProcessingScreen() {
  const params = useLocalSearchParams<{ uri?: string; fileName?: string; mimeType?: string }>();
  const { setPendingExtraction } = useSpendWise();
  const [status, setStatus] = useState<ProcessStatus>('processing');
  const [progress, setProgress] = useState(12);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const timers = [
      setTimeout(() => active && setProgress(38), 180),
      setTimeout(() => active && setProgress(72), 450),
    ];

    async function processReceipt() {
      if (!params.uri) {
        setStatus('failure');
        setError('No receipt image was provided.');
        return;
      }

      setStatus('processing');
      setProgress(12);
      setError(null);
      const document: ReceiptDocument = {
        id: `document-${Date.now()}`,
        uri: params.uri,
        fileName: params.fileName || undefined,
        mimeType: params.mimeType || undefined,
        importedAt: new Date().toISOString(),
      };

      try {
        const extraction = await services.extractor.extract(document);
        if (!active) return;
        setProgress(100);
        setPendingExtraction(extraction);
        setTimeout(() => active && router.replace('/review'), 250);
      } catch (caughtError) {
        if (!active) return;
        setStatus('failure');
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'The local demo extractor failed.',
        );
      }
    }

    void processReceipt();
    return () => {
      active = false;
      timers.forEach(clearTimeout);
    };
  }, [attempt, params.fileName, params.mimeType, params.uri, setPendingExtraction]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <Ionicons
            color={status === 'failure' ? colors.danger : colors.accent}
            name={status === 'failure' ? 'alert-circle-outline' : 'receipt-outline'}
            size={44}
          />
        </View>
        <View style={styles.copy}>
          <Text accessibilityRole="header" style={styles.title}>
            {status === 'failure' ? 'Processing stopped' : 'Reading receipt locally'}
          </Text>
          <Text style={styles.description}>
            {status === 'failure'
              ? error
              : 'A deterministic mock is preparing editable example data. No image is uploaded and no AI service is connected.'}
          </Text>
        </View>

        {status === 'processing' ? (
          <View style={styles.progressArea}>
            <View accessibilityRole="progressbar" style={styles.track}>
              <View style={[styles.fill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressLabel}>{progress}% · Local demo extraction</Text>
          </View>
        ) : (
          <View style={styles.actions}>
            <Button label="Try again" onPress={() => setAttempt((value) => value + 1)} />
            <Button label="Choose another image" onPress={() => router.replace('/import')} variant="secondary" />
          </View>
        )}

        <Button label="Cancel" onPress={() => router.replace('/import')} variant="ghost" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.xxl },
  iconWrap: { width: 80, height: 80, borderRadius: 40, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  copy: { gap: spacing.sm, alignItems: 'center' },
  title: { color: colors.text, fontSize: 26, lineHeight: 32, fontWeight: '800', textAlign: 'center' },
  description: { color: colors.textMuted, fontSize: 15, lineHeight: 23, textAlign: 'center' },
  progressArea: { gap: spacing.sm },
  track: { height: 10, borderRadius: radii.pill, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.accent, borderRadius: radii.pill },
  progressLabel: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  actions: { gap: spacing.sm },
});
