import AsyncStorage from '@react-native-async-storage/async-storage';

import { buildDemoTransactions } from '@/data/demoTransactions';
import type { Transaction } from '@/domain/models';
import type { TransactionRepository } from '@/services/contracts';
import { sortTransactionsNewestFirst } from '@/utils/transactions';

const STORAGE_KEY = '@spendwise/transactions/v1';

interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export class LocalTransactionRepository implements TransactionRepository {
  constructor(private readonly storage: StorageAdapter = AsyncStorage) {}

  async list(): Promise<Transaction[]> {
    const stored = await this.storage.getItem(STORAGE_KEY);
    if (!stored) {
      return this.resetDemoData();
    }

    const transactions = JSON.parse(stored) as Transaction[];
    return sortTransactionsNewestFirst(transactions);
  }

  async getById(id: string): Promise<Transaction | null> {
    const transactions = await this.list();
    return transactions.find((transaction) => transaction.id === id) ?? null;
  }

  async save(transaction: Transaction): Promise<void> {
    const transactions = await this.list();
    const existingIndex = transactions.findIndex(
      (candidate) => candidate.id === transaction.id,
    );

    if (existingIndex >= 0) {
      transactions[existingIndex] = transaction;
    } else {
      transactions.push(transaction);
    }

    await this.storage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  }

  async resetDemoData(): Promise<Transaction[]> {
    const transactions = buildDemoTransactions();
    await this.storage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    return sortTransactionsNewestFirst(transactions);
  }
}
