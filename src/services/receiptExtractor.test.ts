import { parseReceiptText } from '@/services/receiptExtractor';

describe('parseReceiptText', () => {
  it('extracts fields and items from actual receipt text', () => {
    const receipt = parseReceiptText('CORNER STORE\nDATE 2026-08-27\nMILK 45.00\nTOTAL INR 45.00');
    expect(receipt).toMatchObject({
      merchant: 'CORNER STORE',
      purchaseDate: '2026-08-27',
      total: 45,
      currency: 'INR',
      productName: 'MILK',
      source: 'receipt',
      extractionMethod: 'text',
    });
    expect(receipt.lineItems).toEqual([{ id: 'parsed-item-0', name: 'MILK', quantity: 1, unitPrice: 45, total: 45 }]);
  });

  it('leaves ambiguous dates empty and prefers the final total over subtotal', () => {
    const receipt = parseReceiptText('SHOP\nDate 04/05/2026\nSubtotal $10.00\nTax $1.00\nTotal $11.00');
    expect(receipt.purchaseDate).toBe('');
    expect(receipt.total).toBe(11);
  });

  it('keeps policy dates estimated until the person verifies them', () => {
    const receipt = parseReceiptText('SHOP\nDate 2026-08-27\nTotal INR 45.00\nReturn by 2026-09-10\nWarranty expires 2027-08-27');
    expect(receipt.returnDeadline).toEqual({ date: '2026-09-10', certainty: 'estimated' });
    expect(receipt.warrantyExpiry).toEqual({ date: '2027-08-27', certainty: 'estimated' });
  });

  it('asks for manual review when no text is readable', () => {
    expect(() => parseReceiptText('   ')).toThrow(/No readable text/);
  });
});
