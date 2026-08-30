import { router } from 'expo-router';
import { useState } from 'react';

import { ReviewTransactionForm } from '@/components/ReviewTransactionForm';
import { Screen } from '@/components/Screen';
import { StateNotice } from '@/components/StateNotice';
import type { Transaction } from '@/domain/models';
import { useSpendWise } from '@/state/AppProvider';

export default function ReviewTransactionScreen() {
  const { pendingExtraction, saveTransaction, usage, setPendingExtraction } = useSpendWise();
  const [isSaving, setIsSaving] = useState(false);

  function cancel() {
    setPendingExtraction(null);
    router.replace('/');
  }

  async function save(transaction: Transaction) {
    setIsSaving(true);
    try {
      await saveTransaction(transaction);
      router.replace({ pathname: '/transaction/[id]', params: { id: transaction.id } });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Screen
      description="Confirm the local mock result. Estimated dates should be checked against the merchant policy."
      eyebrow="Human review required"
      title="Review transaction"
    >
      {pendingExtraction ? (
        <ReviewTransactionForm
          extraction={pendingExtraction}
          isLimitReached={usage.isLimitReached}
          isSaving={isSaving}
          onCancel={cancel}
          onSave={save}
        />
      ) : (
        <StateNotice
          actionLabel="Import a receipt"
          message="The temporary extraction is no longer available. Select an image to start again."
          onAction={() => router.replace('/import')}
          title="Nothing to review"
        />
      )}
    </Screen>
  );
}
