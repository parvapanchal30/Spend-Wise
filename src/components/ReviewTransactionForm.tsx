import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import type { ExtractedReceipt, Transaction } from '@/domain/models';
import { colors, radii, spacing } from '@/theme';
import { isValidIsoDate } from '@/utils/dates';

interface ReviewTransactionFormProps {
  extraction: ExtractedReceipt;
  isSaving?: boolean;
  isLimitReached?: boolean;
  onSave(transaction: Transaction): void | Promise<void>;
  onCancel(): void;
}

interface FormValues {
  merchant: string;
  purchaseDate: string;
  total: string;
  currency: string;
  category: string;
  productName: string;
  returnDeadline: string;
  warrantyExpiry: string;
}

type FormErrors = Partial<Record<keyof FormValues | 'form', string>>;

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  const total = Number(values.total.replace(/,/g, ''));

  if (!values.merchant.trim()) errors.merchant = 'Enter the merchant name.';
  if (!isValidIsoDate(values.purchaseDate)) {
    errors.purchaseDate = 'Use a valid date in YYYY-MM-DD format.';
  }
  if (!Number.isFinite(total) || total <= 0) {
    errors.total = 'Enter a total greater than zero.';
  }
  if (!/^[A-Z]{3}$/.test(values.currency.trim().toUpperCase())) {
    errors.currency = 'Use a three-letter currency code, such as INR.';
  }
  if (!values.category.trim()) errors.category = 'Enter a category.';
  if (!values.productName.trim()) errors.productName = 'Enter a product name.';
  if (values.returnDeadline && !isValidIsoDate(values.returnDeadline)) {
    errors.returnDeadline = 'Use a valid date in YYYY-MM-DD format.';
  }
  if (values.warrantyExpiry && !isValidIsoDate(values.warrantyExpiry)) {
    errors.warrantyExpiry = 'Use a valid date in YYYY-MM-DD format.';
  }
  if (
    !errors.purchaseDate &&
    values.returnDeadline &&
    !errors.returnDeadline &&
    values.returnDeadline < values.purchaseDate
  ) {
    errors.returnDeadline = 'Return deadline cannot be before the purchase date.';
  }
  if (
    !errors.purchaseDate &&
    values.warrantyExpiry &&
    !errors.warrantyExpiry &&
    values.warrantyExpiry < values.purchaseDate
  ) {
    errors.warrantyExpiry = 'Warranty expiry cannot be before the purchase date.';
  }

  return errors;
}

export function ReviewTransactionForm({
  extraction,
  isSaving = false,
  isLimitReached = false,
  onSave,
  onCancel,
}: ReviewTransactionFormProps) {
  const initialValues = useMemo<FormValues>(
    () => ({
      merchant: extraction.merchant,
      purchaseDate: extraction.purchaseDate,
      total: String(extraction.total),
      currency: extraction.currency,
      category: extraction.category,
      productName: extraction.productName,
      returnDeadline: extraction.returnDeadline.date,
      warrantyExpiry: extraction.warrantyExpiry.date,
    }),
    [extraction],
  );
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});

  function updateValue(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
  }

  async function handleSave() {
    const nextErrors = validate(values);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const now = new Date().toISOString();
    const total = Number(values.total.replace(/,/g, ''));
    const transaction: Transaction = {
      id: `receipt-${Date.now()}`,
      merchant: values.merchant.trim(),
      purchaseDate: values.purchaseDate,
      total,
      currency: values.currency.trim().toUpperCase(),
      category: values.category.trim(),
      lineItems: [
        {
          id: `item-${Date.now()}`,
          name: values.productName.trim(),
          quantity: 1,
          unitPrice: total,
          total,
        },
      ],
      receiptDocument: extraction.document,
      returnDeadline: values.returnDeadline
        ? { date: values.returnDeadline, certainty: extraction.returnDeadline.certainty }
        : undefined,
      warrantyExpiry: values.warrantyExpiry
        ? { date: values.warrantyExpiry, certainty: extraction.warrantyExpiry.certainty }
        : undefined,
      source: 'receipt',
      createdAt: now,
      updatedAt: now,
    };

    try {
      await onSave(transaction);
    } catch (caughtError) {
      setErrors({
        form:
          caughtError instanceof Error
            ? caughtError.message
            : 'The transaction could not be saved.',
      });
    }
  }

  return (
    <View style={styles.form}>
      <View style={styles.mockNotice}>
        <Text style={styles.mockTitle}>Local mock extraction</Text>
        <Text style={styles.mockCopy}>
          Confidence scores are deterministic demo values. Review every field before saving.
        </Text>
      </View>

      <FormField
        confidence={extraction.confidence.merchant}
        error={errors.merchant}
        label="Merchant"
        onChangeText={(value) => updateValue('merchant', value)}
        value={values.merchant}
      />
      <FormField
        autoCapitalize="none"
        confidence={extraction.confidence.purchaseDate}
        error={errors.purchaseDate}
        hint="YYYY-MM-DD"
        label="Purchase date"
        onChangeText={(value) => updateValue('purchaseDate', value)}
        value={values.purchaseDate}
      />
      <View style={styles.splitRow}>
        <View style={styles.totalField}>
          <FormField
            confidence={extraction.confidence.total}
            error={errors.total}
            keyboardType="decimal-pad"
            label="Total"
            onChangeText={(value) => updateValue('total', value)}
            value={values.total}
          />
        </View>
        <View style={styles.currencyField}>
          <FormField
            autoCapitalize="characters"
            confidence={extraction.confidence.currency}
            error={errors.currency}
            label="Currency"
            maxLength={3}
            onChangeText={(value) => updateValue('currency', value)}
            value={values.currency}
          />
        </View>
      </View>
      <FormField
        confidence={extraction.confidence.category}
        error={errors.category}
        label="Category"
        onChangeText={(value) => updateValue('category', value)}
        value={values.category}
      />
      <FormField
        confidence={extraction.confidence.productName}
        error={errors.productName}
        label="Product name"
        onChangeText={(value) => updateValue('productName', value)}
        value={values.productName}
      />
      <FormField
        autoCapitalize="none"
        confidence={extraction.confidence.returnDeadline}
        error={errors.returnDeadline}
        hint={`YYYY-MM-DD · ${extraction.returnDeadline.certainty}`}
        label="Return deadline"
        onChangeText={(value) => updateValue('returnDeadline', value)}
        value={values.returnDeadline}
      />
      <FormField
        autoCapitalize="none"
        confidence={extraction.confidence.warrantyExpiry}
        error={errors.warrantyExpiry}
        hint={`YYYY-MM-DD · ${extraction.warrantyExpiry.certainty}`}
        label="Warranty expiry"
        onChangeText={(value) => updateValue('warrantyExpiry', value)}
        value={values.warrantyExpiry}
      />

      {errors.form ? <Text style={styles.formError}>{errors.form}</Text> : null}
      {isLimitReached ? (
        <Text style={styles.formError}>
          The mock Free plan limit is reached. Reset demo data to continue testing.
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button
          accessibilityLabel="Save reviewed transaction"
          disabled={isLimitReached}
          label="Save transaction"
          loading={isSaving}
          onPress={() => void handleSave()}
        />
        <Button label="Cancel" onPress={onCancel} variant="ghost" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  mockNotice: { padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.infoSoft, gap: spacing.xs },
  mockTitle: { color: colors.info, fontSize: 14, fontWeight: '800' },
  mockCopy: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  splitRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  totalField: { flex: 1.5 },
  currencyField: { flex: 1 },
  formError: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
