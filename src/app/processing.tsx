import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import type { ReceiptDocument } from '@/domain/models';
import { createManualExtraction } from '@/services/receiptExtractor';
import { services } from '@/services/serviceContainer';
import { useSpendWise } from '@/state/AppProvider';
import { colors, spacing } from '@/theme';

export default function ProcessingScreen() {
  const params = useLocalSearchParams<{ uri?: string; id?: string; importedAt?: string; fileName?: string; mimeType?: string }>();
  const { setPendingExtraction, settings } = useSpendWise();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const document = useMemo<ReceiptDocument | undefined>(() => params.uri && params.id && params.importedAt ? { id: params.id, uri: params.uri, fileName: params.fileName || undefined, mimeType: params.mimeType || undefined, importedAt: params.importedAt } : undefined, [params.uri, params.id, params.importedAt, params.fileName, params.mimeType]);

  useEffect(() => {
    let active = true;
    async function processReceipt() {
      setError(null);
      if (!document) { setError('No receipt image was provided.'); return; }
      try {
        const extraction = await services.extractor.extract(document);
        if (!active) return;
        setPendingExtraction(extraction);
        router.replace('/review');
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'The receipt could not be read.');
      }
    }
    void processReceipt();
    return () => { active = false; };
  }, [attempt, document, setPendingExtraction]);

  function enterManually() {
    setPendingExtraction(createManualExtraction(document, settings.defaultCurrency));
    router.replace('/review');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.iconWrap}><Ionicons color={error ? colors.danger : colors.accent} name={error ? 'alert-circle-outline' : 'receipt-outline'} size={44} /></View>
        <View style={styles.copy}>
          <Text accessibilityRole="header" style={styles.title}>{error ? 'Receipt needs your help' : 'Reading your receipt'}</Text>
          <Text style={styles.description}>{error ?? 'The receipt reading service is finding text in your image. This can take a minute. You will review every detail before saving.'}</Text>
        </View>
        {!error ? <ActivityIndicator accessibilityLabel="Reading receipt" size="large" color={colors.accent} /> : <Button label="Try again" onPress={() => setAttempt((value) => value + 1)} />}
        <Button label="Enter details manually" onPress={enterManually} variant="secondary" />
        <Button label="Cancel" onPress={() => router.replace('/import')} variant="ghost" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg },
  iconWrap: { width: 80, height: 80, borderRadius: 40, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  copy: { gap: spacing.sm, alignItems: 'center' },
  title: { color: colors.text, fontSize: 26, lineHeight: 32, fontWeight: '800', textAlign: 'center' },
  description: { color: colors.textMuted, fontSize: 15, lineHeight: 23, textAlign: 'center' },
});
