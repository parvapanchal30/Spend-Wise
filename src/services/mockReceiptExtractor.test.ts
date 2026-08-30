import type { ReceiptDocument } from '@/domain/models';
import { MockReceiptExtractor } from '@/services/mockReceiptExtractor';

describe('MockReceiptExtractor', () => {
  it('returns deterministic editable Amazon receipt data without a remote service', async () => {
    const extractor = new MockReceiptExtractor(0, () => new Date(2026, 7, 30));
    const document: ReceiptDocument = {
      id: 'receipt-test',
      uri: 'file:///receipt.jpg',
      importedAt: '2026-08-30T00:00:00.000Z',
    };

    const result = await extractor.extract(document);

    expect(result).toMatchObject({
      merchant: 'Amazon',
      productName: 'Sony WH-1000XM5 headphones',
      total: 8999,
      currency: 'INR',
      category: 'Electronics',
      purchaseDate: '2026-08-27',
      returnDeadline: { date: '2026-09-11', certainty: 'estimated' },
      warrantyExpiry: { date: '2027-08-27', certainty: 'estimated' },
    });
    expect(result.document).toBe(document);
  });
});
