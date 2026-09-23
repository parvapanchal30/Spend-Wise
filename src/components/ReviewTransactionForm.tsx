import { useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import type { ExtractedReceipt, Transaction } from '@/domain/models';
import { colors, radii, spacing } from '@/theme';
import { isValidIsoDate } from '@/utils/dates';

interface ReviewTransactionFormProps {
  extraction: ExtractedReceipt;
  existingTransaction?: Transaction;
  transactions?: Transaction[];
  isSaving?: boolean;
  isLimitReached?: boolean;
  onSave(transaction: Transaction, options?: { allowDuplicate?: boolean }): void | Promise<void>;
  onCancel(): void;
}

interface FormValues {
  merchant: string;
  purchaseDate: string;
  total: string;
  currency: string;
  category: string;
  returnDeadline: string;
  warrantyExpiry: string;
  notes: string;
}
interface ItemValues { id: string; name: string; quantity: string; unitPrice: string; total: string; }
type FormErrors = Partial<Record<keyof FormValues | 'form' | 'items', string>>;
const amount = (value: string) => Number(value.replace(/,/g, ''));
const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

function validate(values: FormValues, items: ItemValues[]): FormErrors {
  const errors: FormErrors = {};
  if (!values.merchant.trim()) errors.merchant = 'Enter the merchant name.';
  if (!isValidIsoDate(values.purchaseDate)) errors.purchaseDate = 'Use a valid date in YYYY-MM-DD format.';
  if (!Number.isFinite(amount(values.total)) || amount(values.total) <= 0 || amount(values.total) >= 1e12) errors.total = 'Enter a total greater than zero.';
  if (!/^[A-Z]{3}$/.test(values.currency.trim().toUpperCase())) errors.currency = 'Use a three-letter currency code, such as INR.';
  for (const field of ['returnDeadline', 'warrantyExpiry'] as const) {
    if (values[field] && !isValidIsoDate(values[field])) errors[field] = 'Use a valid date in YYYY-MM-DD format.';
    else if (values[field] && !errors.purchaseDate && values[field] < values.purchaseDate) errors[field] = `${field === 'returnDeadline' ? 'Return deadline' : 'Warranty expiry'} cannot be before the purchase date.`;
  }
  for (const item of items.filter((item) => item.name.trim() || item.unitPrice.trim())) {
    if (!item.name.trim() || !item.unitPrice.trim() || !Number.isFinite(amount(item.unitPrice)) || amount(item.unitPrice) < 0 || !item.total.trim() || !Number.isFinite(amount(item.total)) || amount(item.total) < 0 || amount(item.total) >= 1e12 || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0 || amount(item.unitPrice) * Number(item.quantity) >= 1e12) {
      errors.items = 'Each item needs a name, a quantity greater than zero, and a valid unit price.';
      break;
    }
  }
  return errors;
}

export function ReviewTransactionForm({ extraction, existingTransaction, transactions = [], isSaving = false, isLimitReached = false, onSave, onCancel }: ReviewTransactionFormProps) {
  const initialValues = useMemo<FormValues>(() => ({
    merchant: existingTransaction?.merchant ?? extraction.merchant,
    purchaseDate: existingTransaction?.purchaseDate ?? extraction.purchaseDate,
    total: (existingTransaction?.total ?? extraction.total) > 0 ? String(existingTransaction?.total ?? extraction.total) : '',
    currency: existingTransaction?.currency ?? extraction.currency,
    category: existingTransaction?.category ?? extraction.category,
    returnDeadline: existingTransaction?.returnDeadline?.date ?? extraction.returnDeadline.date,
    warrantyExpiry: existingTransaction?.warrantyExpiry?.date ?? extraction.warrantyExpiry.date,
    notes: existingTransaction?.notes ?? extraction.notes ?? '',
  }), [existingTransaction, extraction]);
  const [values, setValues] = useState(initialValues);
  const [items, setItems] = useState<ItemValues[]>(() => {
    const source = existingTransaction?.lineItems ?? extraction.lineItems ?? (extraction.productName ? [{ id: `item-${newId()}`, name: extraction.productName, quantity: 1, unitPrice: extraction.total, total: extraction.total }] : []);
    return source.length ? source.map((item) => ({ id: item.id, name: item.name, quantity: String(item.quantity), unitPrice: String(item.unitPrice), total: String(item.total) })) : [{ id: `item-${newId()}`, name: '', quantity: '1', unitPrice: '', total: '' }];
  });
  const [returnVerified, setReturnVerified] = useState((existingTransaction?.returnDeadline ?? extraction.returnDeadline)?.certainty === 'confirmed');
  const [warrantyVerified, setWarrantyVerified] = useState((existingTransaction?.warrantyExpiry ?? extraction.warrantyExpiry)?.certainty === 'confirmed');
  const [showText, setShowText] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const saving = useRef(false);
  const [acknowledgeDuplicate, setAcknowledgeDuplicate] = useState(false);
  const duplicate = transactions.find((transaction) => transaction.id !== existingTransaction?.id && transaction.merchant.trim().toLowerCase() === values.merchant.trim().toLowerCase() && transaction.purchaseDate === values.purchaseDate && transaction.total === amount(values.total) && transaction.currency === values.currency.trim().toUpperCase());
  const document = existingTransaction?.receiptDocument ?? extraction.document;
  const busy = isSaving || submitting;
  const itemTotal = items.reduce((sum, item) => sum + (Number.isFinite(amount(item.total)) ? amount(item.total) : 0), 0);

  function updateValue(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
    setAcknowledgeDuplicate(false);
    if (field === 'returnDeadline') setReturnVerified(false);
    if (field === 'warrantyExpiry') setWarrantyVerified(false);
  }
  function updateItem(index: number, field: keyof Omit<ItemValues, 'id'>, value: string) {
    setItems((current) => current.map((item, position) => {
      if (position !== index) return item;
      const next = { ...item, [field]: value };
      if (field === 'quantity' || field === 'unitPrice') next.total = next.unitPrice.trim() && Number.isFinite(Number(next.quantity) * amount(next.unitPrice)) ? (Number(next.quantity) * amount(next.unitPrice)).toFixed(2) : '';
      return next;
    }));
    setErrors((current) => ({ ...current, items: undefined, form: undefined }));
  }

  async function handleSave() {
    if (busy || saving.current || isLimitReached) return;
    const nextErrors = validate(values, items);
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); return; }
    if (duplicate && !acknowledgeDuplicate) { setErrors({ form: 'This purchase may already be saved. Confirm below to save it as a separate purchase.' }); return; }
    const now = new Date().toISOString();
    const transaction: Transaction = {
      ...existingTransaction,
      id: existingTransaction?.id ?? `receipt-${newId()}`,
      merchant: values.merchant.trim(), purchaseDate: values.purchaseDate, total: amount(values.total), currency: values.currency.trim().toUpperCase(), category: values.category.trim() || 'Uncategorized',
      lineItems: items.filter((item) => item.name.trim() || item.unitPrice.trim()).map((item) => ({ id: item.id, name: item.name.trim(), quantity: Number(item.quantity), unitPrice: amount(item.unitPrice), total: amount(item.total) })),
      receiptDocument: document,
      returnDeadline: values.returnDeadline ? { date: values.returnDeadline, certainty: returnVerified ? 'confirmed' : 'estimated' } : undefined,
      warrantyExpiry: values.warrantyExpiry ? { date: values.warrantyExpiry, certainty: warrantyVerified ? 'confirmed' : 'estimated' } : undefined,
      notes: values.notes.trim() || undefined,
      rawText: existingTransaction?.rawText ?? extraction.rawText,
      source: existingTransaction?.source ?? extraction.source ?? (document ? 'receipt' : 'manual'),
      createdAt: existingTransaction?.createdAt ?? now, updatedAt: now,
    };
    saving.current = true;
    setSubmitting(true);
    try { await onSave(transaction, { allowDuplicate: acknowledgeDuplicate }); }
    catch (caught) { setErrors({ form: caught instanceof Error ? caught.message : 'The transaction could not be saved.' }); }
    finally { saving.current = false; setSubmitting(false); }
  }

  return (
    <View style={styles.form}>
      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>{existingTransaction ? 'Update this purchase' : extraction.extractionMethod === 'ocr' ? 'Review the receipt reading' : extraction.extractionMethod === 'text' ? 'Review the receipt text' : 'Add your purchase details'}</Text>
        <Text style={styles.noticeCopy}>Merchant, purchase date, total, and currency are required. Add items and deadlines when you know them. Verify dates against the merchant policy.</Text>
      </View>
      {document && document.mimeType !== 'text/plain' ? <Image accessibilityLabel="Receipt reference" source={{ uri: document.uri }} resizeMode="contain" style={styles.receipt} /> : null}
      {extraction.rawText ? <View style={styles.section}>
        <Button label={showText ? 'Hide original receipt text' : 'Show original receipt text'} onPress={() => setShowText(!showText)} variant="ghost" />
        {showText ? <Text selectable style={styles.noticeCopy}>{extraction.rawText}</Text> : null}
      </View> : null}
      <FormField label="Merchant" error={errors.merchant} maxLength={200} onChangeText={(value) => updateValue('merchant', value)} value={values.merchant} />
      <FormField label="Purchase date" autoCapitalize="none" error={errors.purchaseDate} hint="YYYY-MM-DD" maxLength={10} onChangeText={(value) => updateValue('purchaseDate', value)} value={values.purchaseDate} />
      <View style={styles.splitRow}>
        <View style={styles.totalField}><FormField label="Total" error={errors.total} keyboardType="decimal-pad" onChangeText={(value) => updateValue('total', value)} value={values.total} /></View>
        <View style={styles.currencyField}><FormField label="Currency" autoCapitalize="characters" error={errors.currency} hint="e.g. INR, USD, EUR" maxLength={3} onChangeText={(value) => updateValue('currency', value)} value={values.currency} /></View>
      </View>
      <FormField label="Category" hint="Optional · defaults to Uncategorized" maxLength={80} onChangeText={(value) => updateValue('category', value)} value={values.category} />
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Items (optional)</Text>
        {items.map((item, index) => <View key={item.id} style={styles.item}>
          <FormField label={index === 0 ? 'Product name' : `Item ${index + 1} name`} maxLength={200} onChangeText={(value) => updateItem(index, 'name', value)} value={item.name} />
          <View style={styles.splitRow}>
            <View style={styles.currencyField}><FormField label={`Item ${index + 1} quantity`} keyboardType="decimal-pad" onChangeText={(value) => updateItem(index, 'quantity', value)} value={item.quantity} /></View>
            <View style={styles.totalField}><FormField label={`Item ${index + 1} unit price`} keyboardType="decimal-pad" onChangeText={(value) => updateItem(index, 'unitPrice', value)} value={item.unitPrice} /></View>
          </View>
          <FormField label={`Item ${index + 1} total`} hint="Adjust for item discounts if needed" keyboardType="decimal-pad" onChangeText={(value) => updateItem(index, 'total', value)} value={item.total} />
          <Button label={`Remove item ${index + 1}`} onPress={() => setItems((current) => current.filter((_, position) => position !== index))} variant="ghost" />
        </View>)}
        {errors.items ? <Text style={styles.formError}>{errors.items}</Text> : null}
        <Text style={styles.noticeCopy}>Item subtotal: {itemTotal.toFixed(2)} {values.currency.toUpperCase()}. Your purchase total can also include tax, shipping, or discounts.</Text>
        <Button label="Add item" icon="add-outline" onPress={() => setItems((current) => [...current, { id: `item-${newId()}`, name: '', quantity: '1', unitPrice: '', total: '' }])} variant="secondary" />
      </View>
      <FormField label="Return deadline" autoCapitalize="none" error={errors.returnDeadline} hint="Optional · YYYY-MM-DD" maxLength={10} onChangeText={(value) => updateValue('returnDeadline', value)} value={values.returnDeadline} />
      {values.returnDeadline ? <View style={styles.confirmRow}><Text style={styles.noticeCopy}>I verified the return date</Text><Switch accessibilityLabel="Return date verified" value={returnVerified} onValueChange={setReturnVerified} /></View> : null}
      <FormField label="Warranty expiry" autoCapitalize="none" error={errors.warrantyExpiry} hint="Optional · YYYY-MM-DD" maxLength={10} onChangeText={(value) => updateValue('warrantyExpiry', value)} value={values.warrantyExpiry} />
      {values.warrantyExpiry ? <View style={styles.confirmRow}><Text style={styles.noticeCopy}>I verified the warranty date</Text><Switch accessibilityLabel="Warranty date verified" value={warrantyVerified} onValueChange={setWarrantyVerified} /></View> : null}
      <FormField label="Notes" hint="Optional · order number, policy, or purchase context" multiline numberOfLines={3} maxLength={5000} onChangeText={(value) => updateValue('notes', value)} value={values.notes} style={styles.notes} />
      {duplicate ? <View style={styles.notice}><Text style={styles.noticeTitle}>Possible duplicate purchase</Text><Text style={styles.noticeCopy}>A purchase from {duplicate.merchant} on {duplicate.purchaseDate} has the same total and currency.</Text><View style={styles.confirmRow}><Text style={styles.noticeCopy}>Save as a separate purchase</Text><Switch accessibilityLabel="Save as separate purchase" value={acknowledgeDuplicate} onValueChange={setAcknowledgeDuplicate} /></View></View> : null}
      {errors.form ? <Text accessibilityRole="alert" style={styles.formError}>{errors.form}</Text> : null}
      {isLimitReached ? <Text style={styles.formError}>The transaction limit has been reached.</Text> : null}
      <View style={styles.actions}>
        <Button accessibilityLabel={existingTransaction ? 'Save changes' : 'Save reviewed transaction'} disabled={isLimitReached} label={existingTransaction ? 'Save changes' : 'Save transaction'} loading={busy} onPress={() => void handleSave()} />
        <Button label="Cancel" onPress={onCancel} disabled={busy} variant="ghost" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  notice: { padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.infoSoft, gap: spacing.xs },
  noticeTitle: { color: colors.info, fontSize: 14, fontWeight: '800' },
  noticeCopy: { color: colors.textMuted, fontSize: 13, lineHeight: 19, flexShrink: 1 },
  receipt: { width: '100%', height: 230, backgroundColor: colors.surfaceMuted, borderRadius: radii.md },
  section: { gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  item: { padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, gap: spacing.md },
  splitRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  totalField: { flex: 1.5 },
  currencyField: { flex: 1 },
  confirmRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  notes: { minHeight: 95, paddingVertical: spacing.md, textAlignVertical: 'top' },
  formError: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
