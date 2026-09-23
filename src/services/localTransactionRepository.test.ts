import type { Transaction } from '@/domain/models';
import { LEGACY_TRANSACTION_BACKUP_KEY, LEGACY_TRANSACTION_STORAGE_KEY, LocalTransactionRepository, TRANSACTION_STORAGE_KEY } from '@/services/localTransactionRepository';

function transaction(id: string, overrides: Partial<Transaction> = {}): Transaction {
  return { id, merchant: `Merchant ${id}`, purchaseDate: '2026-09-20', total: 25.5, currency: 'INR', category: 'Food', lineItems: [], source: 'manual', createdAt: '2026-09-20T12:00:00.000Z', updatedAt: '2026-09-20T12:00:00.000Z', ...overrides };
}

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: jest.fn(async (key: string) => data.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { data.set(key, value); }),
  };
}

describe('LocalTransactionRepository', () => {
  it('starts empty without manufacturing records', async () => {
    const storage = memoryStorage();
    expect(await new LocalTransactionRepository(storage).list()).toEqual([]);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('migrates real v1 records once and keeps an exact backup', async () => {
    const legacy = JSON.stringify([transaction('demo', { source: 'demo' }), transaction('real', { source: 'receipt' })]);
    const storage = memoryStorage({ [LEGACY_TRANSACTION_STORAGE_KEY]: legacy });
    const repository = new LocalTransactionRepository(storage);
    expect((await repository.list()).map(({ id }) => id)).toEqual(['real']);
    expect(storage.data.get(LEGACY_TRANSACTION_BACKUP_KEY)).toBe(legacy);
    expect(storage.data.get(LEGACY_TRANSACTION_STORAGE_KEY)).toBe(legacy);
    expect((await repository.list()).map(({ id }) => id)).toEqual(['real']);
    expect(storage.setItem).toHaveBeenCalledTimes(2);
  });

  it.each(['{broken', '', JSON.stringify({ version: 9, transactions: [] }), JSON.stringify({ version: 2, transactions: [{ id: 'broken' }] })])('preserves corrupt data and rejects writes (%s)', async (raw) => {
    const storage = memoryStorage({ [TRANSACTION_STORAGE_KEY]: raw });
    const repository = new LocalTransactionRepository(storage);
    await expect(repository.list()).rejects.toThrow('preserved');
    await expect(repository.save(transaction('new'))).rejects.toThrow('preserved');
    expect(storage.data.get(TRANSACTION_STORAGE_KEY)).toBe(raw);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('preserves invalid legacy data without partially migrating', async () => {
    const storage = memoryStorage({ [LEGACY_TRANSACTION_STORAGE_KEY]: JSON.stringify([transaction('good'), { id: 'bad' }]) });
    await expect(new LocalTransactionRepository(storage).list()).rejects.toThrow('could not be migrated');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('serializes concurrent saves across repository instances without losing records', async () => {
    const storage = memoryStorage();
    const first = new LocalTransactionRepository(storage);
    const second = new LocalTransactionRepository(storage);
    await Promise.all(Array.from({ length: 30 }, (_, index) => (index % 2 ? first : second).save(transaction(String(index)))));
    expect(await first.list()).toHaveLength(30);
  });

  it('validates a whole batch before making any writes', async () => {
    const storage = memoryStorage();
    const repository = new LocalTransactionRepository(storage);
    await repository.save(transaction('existing'));
    const before = storage.data.get(TRANSACTION_STORAGE_KEY);
    await expect(repository.saveMany([transaction('valid'), transaction('invalid', { total: -1 })])).rejects.toThrow('positive');
    expect(storage.data.get(TRANSACTION_STORAGE_KEY)).toBe(before);
    await expect(repository.saveMany([transaction('duplicate'), transaction('duplicate')])).rejects.toThrow('Duplicate transaction ID');
  });

  it('updates, deletes, and clears without restoring demo records', async () => {
    const storage = memoryStorage();
    const repository = new LocalTransactionRepository(storage);
    await repository.saveMany([transaction('a'), transaction('b')]);
    await repository.save(transaction('a', { total: 40 }));
    expect((await repository.getById('a'))?.total).toBe(40);
    await repository.delete('a');
    expect(await repository.getById('a')).toBeNull();
    expect(await repository.list()).toHaveLength(1);
    await repository.clear();
    expect(await new LocalTransactionRepository(storage).list()).toEqual([]);
  });

  it('continues after a failed storage write, preserving earlier data', async () => {
    const storage = memoryStorage();
    const repository = new LocalTransactionRepository(storage);
    await repository.save(transaction('a'));
    storage.setItem.mockRejectedValueOnce(new Error('Disk full'));
    await expect(repository.save(transaction('b'))).rejects.toThrow('Disk full');
    await repository.save(transaction('c'));
    expect((await repository.list()).map(({ id }) => id).sort()).toEqual(['a', 'c']);
  });

  it('erases both legacy copies when a migrated purchase is deleted', async () => {
    const legacy = JSON.stringify([transaction('private')]);
    const storage = memoryStorage({ [LEGACY_TRANSACTION_STORAGE_KEY]: legacy });
    const repository = new LocalTransactionRepository(storage);
    await repository.list();
    await repository.delete('private');
    expect(storage.data.get(LEGACY_TRANSACTION_STORAGE_KEY)).toBe('[]');
    expect(storage.data.get(LEGACY_TRANSACTION_BACKUP_KEY)).toBe('[]');
    expect(await repository.list()).toEqual([]);
  });

  it('explicit clear removes corrupt v2 and legacy data without requiring a successful read', async () => {
    const storage = memoryStorage({ [TRANSACTION_STORAGE_KEY]: '{broken', [LEGACY_TRANSACTION_STORAGE_KEY]: 'private', [LEGACY_TRANSACTION_BACKUP_KEY]: 'private' });
    const removeItem = jest.fn(async (key: string) => { storage.data.delete(key); });
    const repository = new LocalTransactionRepository({ ...storage, removeItem });
    await repository.clear();
    expect(await repository.list()).toEqual([]);
    expect(storage.data.has(LEGACY_TRANSACTION_STORAGE_KEY)).toBe(false);
    expect(storage.data.has(LEGACY_TRANSACTION_BACKUP_KEY)).toBe(false);
    expect(removeItem).toHaveBeenCalledTimes(2);
  });

  it('copies a queued record so caller mutation cannot bypass validation', async () => {
    const repository = new LocalTransactionRepository(memoryStorage());
    const item = transaction('a');
    const save = repository.save(item);
    item.total = -50;
    await save;
    expect((await repository.getById('a'))?.total).toBe(25.5);
  });
});
