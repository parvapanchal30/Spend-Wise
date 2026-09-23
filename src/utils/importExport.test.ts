import type { Transaction } from '@/domain/models';
import { deduplicateTransactions, exportBackup, exportTransactionsCsv, findDuplicateTransactions, parseBackup, parseTransactionsCsv } from '@/utils/importExport';

const transaction: Transaction = {
  id: 'real-1', merchant: 'Coffee, "and" cake', purchaseDate: '2026-09-20', total: 125.5, currency: 'INR', category: 'Food',
  lineItems: [{ id: 'item', name: 'Coffee', quantity: 2, unitPrice: 62.75, total: 125.5 }],
  source: 'manual', createdAt: '2026-09-20T12:00:00.000Z', updatedAt: '2026-09-20T12:00:00.000Z',
  notes: 'First line\nSecond, "quoted" line', rawText: 'RECEIPT\nCoffee 125.50', tags: ['work', 'coffee;tea'], recurring: true,
  returnDeadline: { date: '2026-09-25', certainty: 'confirmed' }, warrantyExpiry: { date: '2027-09-20', certainty: 'estimated' },
  guardianStatus: { return: 'resolved', warranty: 'active' },
};

describe('CSV import and export', () => {
  it('round-trips portable fields including multiple lines, quotes, tags, items and deadline state', () => {
    const result = parseTransactionsCsv(exportTransactionsCsv([transaction]));
    expect(result.errors).toEqual([]);
    expect(result.transactions).toEqual([transaction]);
  });

  it('reads common statement headers, BOM, day-first dates and INR defaults', () => {
    const result = parseTransactionsCsv('\uFEFFTransaction Date,Narration,Withdrawal Amt (INR)\r\n20/09/2026,"Shop, Delhi","1,23,456.78"\r\n');
    expect(result.errors).toEqual([]);
    expect(result.transactions[0]).toMatchObject({ purchaseDate: '2026-09-20', merchant: 'Shop, Delhi', total: 123456.78, currency: 'INR', category: 'Uncategorized', source: 'csv' });
  });

  it('uses the selected default currency only when the row has no currency', () => {
    const result = parseTransactionsCsv('Date,Merchant,Amount,Currency\n2026-09-20,Shop,42,\n2026-09-20,Cafe,€12,\n2026-09-20,Market,15,GBP', 'usd');
    expect(result.errors).toEqual([]);
    expect(result.transactions.map(({ currency }) => currency)).toEqual(['USD', 'EUR', 'GBP']);
    expect(parseTransactionsCsv('Date,Merchant,Amount\n2026-09-20,Shop,42', 'dollars').errors).toContain('Default currency must be a three-letter currency code.');
  });

  it('returns valid rows and line-specific errors without inventing missing values', () => {
    const result = parseTransactionsCsv('Date,Merchant,Amount\n2026-09-20,Shop,42\n2026-02-30,Impossible,30\n2026-09-20,,-12\n2026-09-20,Shop,NaN');
    expect(result.transactions).toHaveLength(1);
    expect(result.errors).toHaveLength(3);
    expect(result.errors[0]).toMatch(/^Line 3: Invalid date/);
  });

  it.each([
    ['', 'empty'],
    ['Date,Merchant\n2026-09-20,Shop', 'Include Date'],
    ['Date,Merchant,Amount\n2026-09-20,"Shop,42', 'not closed'],
    ['Date,Merchant,Amount\n2026-09-20,"Shop"bad,42', 'unexpected text'],
    ['Date,Merchant,Amount\n2026-09-20,Shop,1,200', 'Expected 3 columns'],
    ['Date,Merchant,Amount,Amount\n2026-09-20,Shop,42,42', 'unique'],
    ['Date,Merchant,Amount', 'no transactions'],
  ])('rejects malformed input %s', (csv, message) => {
    const result = parseTransactionsCsv(csv);
    expect(result.transactions).toEqual([]);
    expect(result.errors.join(' ')).toContain(message);
  });

  it('skips credit rows in statements and does not treat negatives as expenses', () => {
    const result = parseTransactionsCsv('Date,Description,Amount,Type\n2026-09-20,Purchase,42,Debit\n2026-09-20,Refund,42,Credit\n2026-09-20,Negative,-42,Debit');
    expect(result.transactions).toHaveLength(1);
    expect(result.errors).toHaveLength(2);
  });

  it('uses debit columns in mixed debit-credit statements', () => {
    const result = parseTransactionsCsv('Date,Description,Debit,Credit\n2026-09-20,Purchase,42,\n2026-09-20,Salary,,2000');
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]?.total).toBe(42);
    expect(result.errors).toHaveLength(1);
  });

  it('rejects conflicting currencies and distinguishes currencies in stable IDs', () => {
    expect(parseTransactionsCsv('Date,Merchant,Amount,Currency\n2026-09-20,Shop,$42,INR').errors[0]).toContain('conflicts');
    const result = parseTransactionsCsv('Date,Merchant,Amount,Currency\n2026-09-20,Shop,42,INR\n2026-09-20,Shop,42,USD');
    expect(result.transactions[0]?.id).not.toBe(result.transactions[1]?.id);
  });

  it('protects spreadsheet formulas and restores exact text on re-import', () => {
    const dangerous = { ...transaction, merchant: '=HYPERLINK("https://example.com")', notes: "'@literal", category: ' +formula' };
    const csv = exportTransactionsCsv([dangerous]);
    expect(csv).toContain("'=HYPERLINK");
    const result = parseTransactionsCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.transactions[0]?.merchant).toBe(dangerous.merchant);
    expect(result.transactions[0]?.notes).toBe(dangerous.notes);
  });
});

describe('duplicate detection', () => {
  it('finds same-day merchant/amount/currency matches without matching the edited record', () => {
    const existing = { ...transaction, id: 'existing', merchant: '  COFFEE,   "AND" CAKE  ' };
    expect(findDuplicateTransactions(transaction, [existing, transaction])).toEqual([existing]);
    expect(findDuplicateTransactions({ ...transaction, currency: 'USD' }, [existing])).toEqual([]);
  });

  it('deduplicates against saved data and within the same import', () => {
    const duplicate = { ...transaction, id: 'new-id' };
    const unique = { ...transaction, id: 'unique', total: 99 };
    const result = deduplicateTransactions([duplicate, unique, { ...unique, id: 'repeat' }], [transaction]);
    expect(result.transactions).toEqual([unique]);
    expect(result.duplicates).toHaveLength(2);
  });

  it('assigns deterministic IDs across imports', () => {
    const csv = 'Date,Merchant,Amount\n2026-09-20,Shop,42';
    expect(parseTransactionsCsv(csv).transactions[0]?.id).toBe(parseTransactionsCsv(csv).transactions[0]?.id);
  });
});

describe('portable JSON backups', () => {
  it('round-trips transaction metadata and explicitly excludes device-local images', () => {
    const withImage = { ...transaction, receiptDocument: { id: 'photo', uri: 'file:///private/receipt.jpg', importedAt: transaction.createdAt } };
    const backup = exportBackup([withImage]);
    expect(backup).not.toContain('file:///');
    expect(JSON.parse(backup)).toMatchObject({ format: 'spendwise-backup', version: 1, receiptImagesIncluded: false });
    expect(parseBackup(backup)).toEqual([transaction]);
    expect(withImage.receiptDocument).toBeDefined();
  });

  it('rejects unsupported versions, duplicate IDs and malformed nested records', () => {
    expect(() => parseBackup('{broken')).toThrow('not valid JSON');
    expect(() => parseBackup(JSON.stringify({ format: 'spendwise-backup', version: 3, transactions: [] }))).toThrow('Unsupported');
    expect(() => parseBackup(JSON.stringify({ format: 'spendwise-backup', version: 1, transactions: [transaction, transaction] }))).toThrow('Duplicate transaction ID');
    expect(() => parseBackup(JSON.stringify({ format: 'spendwise-backup', version: 1, transactions: [{ ...transaction, lineItems: [{ id: 'bad' }] }] }))).toThrow('item 1');
  });
});
