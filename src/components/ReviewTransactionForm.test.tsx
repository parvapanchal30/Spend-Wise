import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ReviewTransactionForm } from '@/components/ReviewTransactionForm';
import type { ExtractedReceipt } from '@/domain/models';

const extraction: ExtractedReceipt = {
  document: {
    id: 'document-test',
    uri: 'file:///receipt.jpg',
    importedAt: '2026-08-30T00:00:00.000Z',
  },
  merchant: 'Amazon',
  purchaseDate: '2026-08-27',
  total: 8999,
  currency: 'INR',
  category: 'Electronics',
  productName: 'Sony headphones',
  returnDeadline: { date: '2026-09-11', certainty: 'estimated' },
  warrantyExpiry: { date: '2027-08-27', certainty: 'estimated' },
  confidence: {
    merchant: 0.98,
    purchaseDate: 0.94,
    total: 0.99,
    currency: 0.99,
    category: 0.9,
    productName: 0.93,
    returnDeadline: 0.72,
    warrantyExpiry: 0.68,
  },
};

describe('ReviewTransactionForm', () => {
  it('lets the user correct extracted data and save the reviewed transaction', async () => {
    const onSave = jest.fn();
    const screen = await render(
      <ReviewTransactionForm extraction={extraction} onCancel={jest.fn()} onSave={onSave} />,
    );

    await fireEvent.changeText(screen.getByLabelText('Merchant'), 'Amazon India');
    await fireEvent.press(screen.getByLabelText('Save reviewed transaction'));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      merchant: 'Amazon India',
      total: 8999,
      currency: 'INR',
      source: 'receipt',
    });
  });

  it('shows a helpful error instead of saving an invalid total', async () => {
    const onSave = jest.fn();
    const screen = await render(
      <ReviewTransactionForm extraction={extraction} onCancel={jest.fn()} onSave={onSave} />,
    );

    await fireEvent.changeText(screen.getByLabelText('Total'), '0');
    await fireEvent.press(screen.getByLabelText('Save reviewed transaction'));

    expect(await screen.findByText('Enter a total greater than zero.')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });
});
