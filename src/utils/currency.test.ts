import { formatCurrency } from '@/utils/currency';

describe('formatCurrency', () => {
  it('formats whole rupee amounts with Indian digit grouping', () => {
    expect(formatCurrency(8999)).toContain('₹8,999');
    expect(formatCurrency(1234567)).toContain('₹12,34,567');
  });

  it('preserves paise when present', () => {
    expect(formatCurrency(784.5)).toContain('₹784.50');
  });
});
