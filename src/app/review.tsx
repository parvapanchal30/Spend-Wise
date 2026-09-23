import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { ReviewTransactionForm } from '@/components/ReviewTransactionForm';
import { Screen } from '@/components/Screen';
import { StateNotice } from '@/components/StateNotice';
import type { Transaction } from '@/domain/models';
import { createManualExtraction } from '@/services/receiptExtractor';
import { useSpendWise } from '@/state/AppProvider';

export default function ReviewTransactionScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { pendingExtraction, settings, transactions, saveTransaction, usage, setPendingExtraction } = useSpendWise();
  const [manualExtraction] = useState(() => mode === 'manual' ? createManualExtraction(undefined, settings.defaultCurrency) : null);
  const extraction = manualExtraction ?? pendingExtraction;
  const [isSaving, setIsSaving] = useState(false);

  function cancel() { setPendingExtraction(null); router.replace('/'); }
  async function save(transaction: Transaction) {
    setIsSaving(true);
    try {
      await saveTransaction(transaction);
      router.replace({ pathname: '/transaction/[id]', params: { id: transaction.id } });
    } finally { setIsSaving(false); }
  }

  return (
    <Screen description="Check the receipt details and add anything that is missing before saving." eyebrow="Your purchase" title="Review transaction">
      {extraction ? <ReviewTransactionForm extraction={extraction} transactions={transactions} isLimitReached={usage.isLimitReached} isSaving={isSaving} onCancel={cancel} onSave={save} /> : <StateNotice actionLabel="Add a transaction" message="Start a new purchase or import a receipt to review it here." onAction={() => router.replace('/import')} title="Nothing to review" />}
    </Screen>
  );
}
