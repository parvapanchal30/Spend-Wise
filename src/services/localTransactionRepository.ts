import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Transaction } from '@/domain/models';
import type { TransactionRepository } from '@/services/contracts';
import { sortTransactionsNewestFirst } from '@/utils/transactions';
import { validateTransaction, validateTransactions } from '@/utils/transactionValidation';

export const TRANSACTION_STORAGE_KEY = '@spendwise/transactions/v2';
export const LEGACY_TRANSACTION_STORAGE_KEY = '@spendwise/transactions/v1';
export const LEGACY_TRANSACTION_BACKUP_KEY = '@spendwise/transactions/v1-backup';

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem?(key: string): Promise<void>;
}

// Shared by repository instances using the same adapter, including AsyncStorage.
const storageQueues = new WeakMap<StorageAdapter, Promise<unknown>>();

export class LocalTransactionRepository implements TransactionRepository {
  constructor(private readonly storage: StorageAdapter = AsyncStorage) {}

  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const previous = storageQueues.get(this.storage) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    storageQueues.set(this.storage, current.then(() => undefined, () => undefined));
    return current;
  }

  private async read(): Promise<Transaction[]> {
    const stored = await this.storage.getItem(TRANSACTION_STORAGE_KEY);
    if (stored !== null) {
      try {
        const data: unknown = JSON.parse(stored);
        if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 2 || !('transactions' in data)) {
          throw new Error('Unsupported storage format.');
        }
        return validateTransactions(data.transactions);
      } catch (error) {
        throw new Error(`Saved transactions could not be read. Your stored data has been preserved. ${error instanceof Error ? error.message : 'Invalid data.'}`);
      }
    }

    const legacy = await this.storage.getItem(LEGACY_TRANSACTION_STORAGE_KEY);
    if (legacy === null) return [];
    let transactions: Transaction[];
    try {
      transactions = validateTransactions(JSON.parse(legacy)).filter((transaction) => transaction.source !== 'demo');
    } catch (error) {
      throw new Error(`Existing transactions could not be migrated. Your original data has been preserved. ${error instanceof Error ? error.message : 'Invalid data.'}`);
    }
    // Write the backup before the migration; a failed write never destroys v1.
    if (await this.storage.getItem(LEGACY_TRANSACTION_BACKUP_KEY) === null) {
      await this.storage.setItem(LEGACY_TRANSACTION_BACKUP_KEY, legacy);
    }
    await this.write(transactions);
    return transactions;
  }

  private async write(transactions: Transaction[]): Promise<void> {
    await this.storage.setItem(TRANSACTION_STORAGE_KEY, JSON.stringify({ version: 2, transactions }));
  }

  private async removeMigrationCopies(): Promise<void> {
    // A migration backup is retained until an explicit delete. Afterwards it
    // must not retain a purchase the user asked to remove.
    for (const key of [LEGACY_TRANSACTION_STORAGE_KEY, LEGACY_TRANSACTION_BACKUP_KEY]) {
      if (this.storage.removeItem) await this.storage.removeItem(key);
      else await this.storage.setItem(key, '[]');
    }
  }

  async list(): Promise<Transaction[]> {
    return this.serial(async () => sortTransactionsNewestFirst(await this.read()));
  }

  async getById(id: string): Promise<Transaction | null> {
    return this.serial(async () => (await this.read()).find((transaction) => transaction.id === id) ?? null);
  }

  async save(transaction: Transaction): Promise<void> {
    const validated = validateTransaction(transaction);
    await this.saveMany([validated]);
  }

  async saveMany(transactions: Transaction[]): Promise<void> {
    // Validate and copy the entire batch before entering the write queue.
    const validated = validateTransactions(transactions);
    if (validated.length === 0) return;
    await this.serial(async () => {
      const existing = await this.read();
      const merged = new Map(existing.map((transaction) => [transaction.id, transaction]));
      for (const transaction of validated) merged.set(transaction.id, transaction);
      const next = validateTransactions([...merged.values()]);
      await this.write(next);
    });
  }

  async delete(id: string): Promise<void> {
    await this.serial(async () => {
      const transactions = await this.read();
      await this.write(transactions.filter((transaction) => transaction.id !== id));
      await this.removeMigrationCopies();
    });
  }

  async clear(): Promise<void> {
    // Explicitly clearing also lets a user recover from corrupt local storage.
    await this.serial(async () => {
      await this.write([]);
      await this.removeMigrationCopies();
    });
  }
}
