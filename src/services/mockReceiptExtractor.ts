import type { ExtractedReceipt, ReceiptDocument } from '@/domain/models';
import type { ReceiptExtractor } from '@/services/contracts';
import { addDays, toIsoDate } from '@/utils/dates';

export class MockReceiptExtractor implements ReceiptExtractor {
  constructor(
    private readonly delayMs = 700,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async extract(document: ReceiptDocument): Promise<ExtractedReceipt> {
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));

    if (document.uri.includes('simulate-failure')) {
      throw new Error('The local demo extractor could not read this image.');
    }

    const today = this.now();
    const purchaseDate = addDays(today, -3);

    return {
      document,
      merchant: 'Amazon',
      purchaseDate: toIsoDate(purchaseDate),
      total: 8999,
      currency: 'INR',
      category: 'Electronics',
      productName: 'Sony WH-1000XM5 headphones',
      returnDeadline: {
        date: toIsoDate(addDays(purchaseDate, 15)),
        certainty: 'estimated',
      },
      warrantyExpiry: {
        date: toIsoDate(addDays(purchaseDate, 365)),
        certainty: 'estimated',
      },
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
  }
}
