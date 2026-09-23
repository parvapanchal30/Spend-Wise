import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ReviewTransactionForm } from '@/components/ReviewTransactionForm';
import { Screen } from '@/components/Screen';
import { StateNotice } from '@/components/StateNotice';
import type { ExtractedReceipt, Transaction } from '@/domain/models';
import { useSpendWise } from '@/state/AppProvider';

export default function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { transactions, saveTransaction, isLoading } = useSpendWise();
  const [saving, setSaving] = useState(false);
  const transaction = transactions.find((item) => item.id === id);
  if (!transaction) return <Screen title="Edit purchase"><StateNotice title={isLoading ? 'Loading purchase' : 'Purchase not found'} message="Return to your transactions to select a purchase." /></Screen>;
  const extraction: ExtractedReceipt = {
    merchant: transaction.merchant, purchaseDate: transaction.purchaseDate, total: transaction.total, currency: transaction.currency, category: transaction.category,
    productName: transaction.lineItems[0]?.name ?? '', document: transaction.receiptDocument, lineItems: transaction.lineItems, notes: transaction.notes, rawText: transaction.rawText,
    returnDeadline: transaction.returnDeadline ?? { date: '', certainty: 'confirmed' }, warrantyExpiry: transaction.warrantyExpiry ?? { date: '', certainty: 'confirmed' },
    confidence: { merchant: 1, purchaseDate: 1, total: 1, currency: 1, category: 1, productName: 1, returnDeadline: 1, warrantyExpiry: 1 },
    source: transaction.source === 'demo' ? 'manual' : transaction.source, extractionMethod: 'manual',
  };
  async function save(next: Transaction) {
    setSaving(true);
    try { await saveTransaction(next); router.back(); } finally { setSaving(false); }
  }
  return <Screen title="Edit purchase" description="Correct your record and keep its original receipt and history."><ReviewTransactionForm key={transaction.id} extraction={extraction} existingTransaction={transaction} transactions={transactions} isSaving={saving} onSave={save} onCancel={() => router.back()} /></Screen>;
}
