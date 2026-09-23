import type { Transaction } from '@/domain/models';
import { isValidIsoDate } from '@/utils/dates';
import { transactionFingerprint } from '@/utils/transactions';
import { validateTransaction, validateTransactions } from '@/utils/transactionValidation';

export { deduplicateTransactions, findDuplicateTransactions } from '@/utils/transactions';

export interface CsvImportResult {
  transactions: Transaction[];
  errors: string[];
}

const MAX_IMPORT_CHARACTERS = 20_000_000;
const PORTABLE_NOTICE = 'Receipt image files are not included. Transaction details, extracted text, notes, tags, and deadlines are included. Keep original receipt images separately.';
const SPREADSHEET_UNSAFE = /^(?:['=+\-@\t\r\n]|\s+[=+\-@])/;

function checkInput(text: string): void {
  if (text.length > MAX_IMPORT_CHARACTERS) throw new Error('This file exceeds the 20 MB text import limit. Split it into smaller files.');
  if (!text.trim()) throw new Error('The file is empty.');
}

interface CsvRow { values: string[]; line: number }

/** RFC 4180 fields, including escaped quotes, CRLF, and embedded newlines. */
function readCsv(text: string): CsvRow[] {
  const input = text.replace(/^\uFEFF/, '');
  const rows: CsvRow[] = [];
  let values: string[] = [];
  let field = '';
  let quoted = false;
  let afterQuote = false;
  let line = 1;
  let rowLine = 1;
  function finishRow() {
    values.push(field);
    if (values.some((value) => value.trim())) rows.push({ values, line: rowLine });
    values = [];
    field = '';
    afterQuote = false;
  }
  for (let index = 0; index < input.length; index++) {
    const char = input[index]!;
    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') { field += '"'; index++; }
        else { quoted = false; afterQuote = true; }
      } else {
        field += char;
        if (char === '\n') line++;
      }
      continue;
    }
    if (char === ',') {
      values.push(field);
      field = '';
      afterQuote = false;
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && input[index + 1] === '\n') index++;
      finishRow();
      line++;
      rowLine = line;
    } else if (char === '"') {
      if (field || afterQuote) throw new Error(`Line ${line}: unexpected quote. Put quotes around the entire field and double any inner quotes.`);
      quoted = true;
    } else if (afterQuote) {
      if (char !== ' ' && char !== '\t') throw new Error(`Line ${line}: unexpected text after a closing quote.`);
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error(`Line ${rowLine}: a quoted field is not closed.`);
  if (field || values.length || afterQuote) finishRow();
  return rows;
}

function header(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function readDate(value: string): string {
  const trimmed = value.trim();
  if (isValidIsoDate(trimmed)) return trimmed;
  const yearFirst = /^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/.exec(trimmed);
  const dayFirst = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);
  const result = yearFirst
    ? `${yearFirst[1]}-${yearFirst[2]!.padStart(2, '0')}-${yearFirst[3]!.padStart(2, '0')}`
    : dayFirst ? `${dayFirst[3]}-${dayFirst[2]!.padStart(2, '0')}-${dayFirst[1]!.padStart(2, '0')}` : '';
  if (!isValidIsoDate(result)) throw new Error(`Invalid date "${trimmed}"; use YYYY-MM-DD or DD/MM/YYYY.`);
  return result;
}

function readAmount(value: string): number {
  const cleaned = value.trim().replace(/^(?:INR|USD|EUR|GBP|Rs\.?|₹|\$|€|£)\s*/i, '').replace(/\s*(?:INR|USD|EUR|GBP)$/i, '');
  // Accept both Western and Indian thousands groupings, never decimal commas.
  const plain = /^\d+(?:\.\d+)?$/.test(cleaned);
  const western = /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(cleaned);
  const indian = /^\d{1,2}(?:,\d{2})*,\d{3}(?:\.\d+)?$/.test(cleaned);
  if (!plain && !western && !indian) throw new Error('Amount must be a positive expense; use a decimal point, with optional thousands commas. Credits and negative values are not imported.');
  const total = Number(cleaned.replace(/,/g, ''));
  if (!Number.isFinite(total) || total <= 0 || total > Number.MAX_SAFE_INTEGER) throw new Error('Amount must be greater than zero and within a safe numeric range.');
  return total;
}

function stableId(value: string): string {
  let first = 2166136261;
  let second = 5381;
  for (let index = 0; index < value.length; index++) {
    first = Math.imul(first ^ value.charCodeAt(index), 16777619);
    second = Math.imul(second, 33) ^ value.charCodeAt(index);
  }
  return `csv-${(first >>> 0).toString(16)}${(second >>> 0).toString(16)}`;
}

function boolean(value: string): boolean | undefined {
  if (!value.trim()) return undefined;
  if (/^(true|yes|1)$/i.test(value.trim())) return true;
  if (/^(false|no|0)$/i.test(value.trim())) return false;
  throw new Error('Recurring must be true or false.');
}

/** Dates separated by / or - with the year last are interpreted day-first. */
export function parseTransactionsCsv(text: string, defaultCurrency = 'INR'): CsvImportResult {
  const transactions: Transaction[] = [];
  const errors: string[] = [];
  const fallbackCurrency = defaultCurrency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(fallbackCurrency)) {
    return { transactions, errors: ['Default currency must be a three-letter currency code.'] };
  }
  let rows: CsvRow[];
  try { checkInput(text); rows = readCsv(text); }
  catch (error) { return { transactions, errors: [error instanceof Error ? error.message : 'Invalid CSV.'] }; }
  const first = rows.shift();
  if (!first) return { transactions, errors: ['The CSV contains no header row.'] };
  const headers = first.values.map(header);
  const seenHeaders = new Set<string>();
  for (const name of headers) {
    if (!name || seenHeaders.has(name)) return { transactions, errors: ['Every CSV column must have a unique, nonempty header.'] };
    seenHeaders.add(name);
  }
  const locate = (...names: string[]) => names.map((name) => headers.indexOf(name)).find((index) => index >= 0) ?? -1;
  const indexes = {
    date: locate('date', 'purchasedate', 'transactiondate', 'txndate', 'valuedate', 'posteddate'),
    merchant: locate('merchant', 'merchantname', 'description', 'narration', 'payee', 'particulars', 'name'),
    amount: locate('amount', 'total', 'transactionamount'),
    debit: locate('debit', 'debitamount', 'withdrawal', 'withdrawalamount', 'withdrawals', 'withdrawalamt', 'withdrawalamtinr'),
    direction: locate('type', 'transactiontype', 'debitcredit', 'drcr', 'crdr'),
  };
  if (indexes.date < 0 || indexes.merchant < 0 || (indexes.amount < 0 && indexes.debit < 0)) {
    return { transactions, errors: ['Include Date, Merchant (or Description), and Amount (or Debit/Withdrawal) columns. Optional columns: Category, Currency, Notes, Tags, Recurring, Return deadline, Warranty expiry.'] };
  }
  if (rows.length === 0) return { transactions, errors: ['The CSV contains a header but no transactions.'] };
  if (rows.length > 100000) return { transactions, errors: ['The CSV exceeds the 100,000 transaction limit.'] };
  const now = new Date().toISOString();
  for (const row of rows) {
    try {
      if (row.values.length !== headers.length) throw new Error(`Expected ${headers.length} columns but found ${row.values.length}. Quote values containing commas.`);
      const isOwnExport = row.values[locate('spendwisecsvversion')] === '1';
      const raw = (...names: string[]) => {
        const value = row.values[locate(...names)] ?? '';
        return isOwnExport && value.startsWith("'") && SPREADSHEET_UNSAFE.test(value.slice(1)) ? value.slice(1) : value;
      };
      const read = (...names: string[]) => raw(...names).trim();
      const direction = row.values[indexes.direction]?.trim() ?? '';
      if (/^(?:credit|cr|income|refund|deposit)$/i.test(direction)) throw new Error('Credit or refund row skipped; the spending ledger currently accepts expenses only.');
      if (direction && !/^(?:debit|dr|expense|withdrawal|purchase|payment)$/i.test(direction)) throw new Error(`Unknown transaction type "${direction}". Use debit for expenses or remove the Type column.`);
      const amount = row.values[indexes.debit >= 0 ? indexes.debit : indexes.amount] ?? '';
      const total = readAmount(amount);
      const merchant = read('merchant', 'merchantname', 'description', 'narration', 'payee', 'particulars', 'name');
      const purchaseDate = readDate(row.values[indexes.date] ?? '');
      const explicitCurrency = read('currency', 'currencycode').toUpperCase();
      const symbolCurrency = /(?:USD|\$)/i.test(amount) ? 'USD' : /(?:EUR|€)/i.test(amount) ? 'EUR' : /(?:GBP|£)/i.test(amount) ? 'GBP' : /(?:INR|₹|Rs\.?)/i.test(amount) ? 'INR' : undefined;
      if (explicitCurrency && symbolCurrency && explicitCurrency !== symbolCurrency) throw new Error('The currency column conflicts with the currency in the amount.');
      const currency = explicitCurrency || symbolCurrency || fallbackCurrency;
      const id = read('id', 'transactionid') || stableId(transactionFingerprint({ merchant, purchaseDate, total, currency }));
      const lineItems = raw('lineitems')
        ? JSON.parse(raw('lineitems')) as unknown
        : [{ id: `${id}-item`, name: read('product', 'productname', 'item') || merchant, quantity: 1, unitPrice: total, total }];
      const returnDate = read('returndeadline', 'returnby');
      const warrantyDate = read('warrantyexpiry', 'warrantyexpires');
      const tags = raw('tags');
      const guardianStatus = raw('guardianstatus');
      const candidate = {
        id, merchant, purchaseDate, total, currency,
        category: read('category') || 'Uncategorized',
        lineItems,
        source: read('source') || 'csv',
        createdAt: read('createdat') || now,
        updatedAt: read('updatedat') || now,
        notes: raw('notes') || undefined,
        rawText: raw('rawtext') || undefined,
        tags: tags ? (tags.trim().startsWith('[') ? JSON.parse(tags) as unknown : tags.split(';').map((tag) => tag.trim()).filter(Boolean)) : undefined,
        recurring: boolean(read('recurring')),
        guardianStatus: guardianStatus ? JSON.parse(guardianStatus) as unknown : undefined,
        returnDeadline: returnDate ? { date: readDate(returnDate), certainty: read('returncertainty') || 'confirmed' } : undefined,
        warrantyExpiry: warrantyDate ? { date: readDate(warrantyDate), certainty: read('warrantycertainty') || 'confirmed' } : undefined,
      };
      transactions.push(validateTransaction(candidate));
    } catch (error) {
      errors.push(`Line ${row.line}: ${error instanceof Error ? error.message : 'Invalid transaction.'}`);
    }
  }
  return { transactions, errors };
}

function csvCell(value: unknown): string {
  let text = value === undefined || value === null ? '' : String(value);
  // Prevent spreadsheet formula execution when opening downloaded financial data.
  // The import path removes this prefix only for fields that this exporter protects.
  if (SPREADSHEET_UNSAFE.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function exportTransactionsCsv(transactions: Transaction[]): string {
  const validated = validateTransactions(transactions);
  const columns = ['id', 'date', 'merchant', 'amount', 'currency', 'category', 'notes', 'tags', 'recurring', 'return_deadline', 'return_certainty', 'warranty_expiry', 'warranty_certainty', 'guardian_status', 'line_items', 'raw_text', 'source', 'created_at', 'updated_at', 'spendwise_csv_version'];
  const rows = validated.map((transaction) => [
    transaction.id, transaction.purchaseDate, transaction.merchant, transaction.total,
    transaction.currency, transaction.category, transaction.notes, transaction.tags ? JSON.stringify(transaction.tags) : '',
    transaction.recurring, transaction.returnDeadline?.date, transaction.returnDeadline?.certainty,
    transaction.warrantyExpiry?.date, transaction.warrantyExpiry?.certainty,
    transaction.guardianStatus ? JSON.stringify(transaction.guardianStatus) : '',
    JSON.stringify(transaction.lineItems), transaction.rawText, transaction.source, transaction.createdAt, transaction.updatedAt, 1,
  ].map(csvCell).join(','));
  return [columns.join(','), ...rows].join('\r\n');
}

export function exportBackup(transactions: Transaction[]): string {
  const portableTransactions = validateTransactions(transactions).map((transaction) => {
    const portable = { ...transaction };
    delete portable.receiptDocument;
    return portable;
  });
  return JSON.stringify({
    format: 'spendwise-backup', version: 1, exportedAt: new Date().toISOString(),
    receiptImagesIncluded: false, notice: PORTABLE_NOTICE,
    transactions: portableTransactions,
  }, null, 2);
}

export function parseBackup(text: string): Transaction[] {
  checkInput(text);
  let value: unknown;
  try { value = JSON.parse(text.replace(/^\uFEFF/, '')); }
  catch { throw new Error('This is not valid JSON. Choose an unmodified SpendWise backup file.'); }
  if (!value || typeof value !== 'object' || !('format' in value) || value.format !== 'spendwise-backup' || !('version' in value) || value.version !== 1 || !('transactions' in value)) {
    throw new Error('Unsupported backup format or version. Choose a SpendWise JSON backup exported by this app.');
  }
  const transactions = validateTransactions(value.transactions);
  // Device-local paths and object URLs cannot be trusted to exist on this device.
  return transactions.map((transaction) => {
    const portable = { ...transaction };
    delete portable.receiptDocument;
    return portable;
  });
}
