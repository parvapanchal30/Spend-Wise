import type { Transaction } from '@/domain/models';
import { addDays, toIsoDate } from '@/utils/dates';

export function buildDemoTransactions(now = new Date()): Transaction[] {
  const createdAt = now.toISOString();

  return [
    {
      id: 'demo-myntra',
      merchant: 'Myntra',
      purchaseDate: toIsoDate(addDays(now, -8)),
      total: 1899,
      currency: 'INR',
      category: 'Clothing',
      lineItems: [
        {
          id: 'demo-myntra-item',
          name: 'Fabindia cotton kurta',
          quantity: 1,
          unitPrice: 1899,
          total: 1899,
        },
      ],
      returnDeadline: {
        date: toIsoDate(addDays(now, 7)),
        certainty: 'confirmed',
      },
      source: 'demo',
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'demo-dmart',
      merchant: 'DMart',
      purchaseDate: toIsoDate(addDays(now, -4)),
      total: 2450,
      currency: 'INR',
      category: 'Groceries',
      lineItems: [
        {
          id: 'demo-dmart-item',
          name: 'Monthly groceries',
          quantity: 1,
          unitPrice: 2450,
          total: 2450,
        },
      ],
      source: 'demo',
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'demo-croma',
      merchant: 'Croma',
      purchaseDate: toIsoDate(addDays(now, -20)),
      total: 6499,
      currency: 'INR',
      category: 'Electronics',
      lineItems: [
        {
          id: 'demo-croma-item',
          name: 'Philips air fryer',
          quantity: 1,
          unitPrice: 6499,
          total: 6499,
        },
      ],
      warrantyExpiry: {
        date: toIsoDate(addDays(now, 345)),
        certainty: 'estimated',
      },
      source: 'demo',
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'demo-apollo',
      merchant: 'Apollo Pharmacy',
      purchaseDate: toIsoDate(addDays(now, -2)),
      total: 784,
      currency: 'INR',
      category: 'Health',
      lineItems: [
        {
          id: 'demo-apollo-item',
          name: 'Wellness essentials',
          quantity: 1,
          unitPrice: 784,
          total: 784,
        },
      ],
      source: 'demo',
      createdAt,
      updatedAt: createdAt,
    },
  ];
}
