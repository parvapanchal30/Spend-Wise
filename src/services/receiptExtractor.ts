import { Platform } from 'react-native';

import type { ExtractedReceipt, LineItem, ReceiptDocument } from '@/domain/models';
import type { ReceiptExtractor } from '@/services/contracts';
import { isValidIsoDate } from '@/utils/dates';

export const OCR_URL = process.env.EXPO_PUBLIC_OCR_URL?.trim() ?? '';
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
export const MAX_RECEIPT_TEXT = 100_000;

export function createManualExtraction(document?: ReceiptDocument, currency = ''): ExtractedReceipt {
  return {
    document, merchant: '', purchaseDate: '', total: 0, currency, category: '', productName: '',
    returnDeadline: { date: '', certainty: 'estimated' },
    warrantyExpiry: { date: '', certainty: 'estimated' },
    confidence: { merchant: 0, purchaseDate: 0, total: 0, currency: 0, category: 0, productName: 0, returnDeadline: 0, warrantyExpiry: 0 },
    source: document ? 'receipt' : 'manual', extractionMethod: 'manual',
  };
}

function readDate(text: string): string {
  const iso = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) {
    const candidate = `${iso[1]}-${iso[2]!.padStart(2, '0')}-${iso[3]!.padStart(2, '0')}`;
    return isValidIsoDate(candidate) ? candidate : '';
  }
  const named = text.match(/\b(\d{1,2})[\s/-]+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[\s,/-]+(20\d{2})\b/i);
  const reversed = text.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[\s/-]+(\d{1,2})[\s,/-]+(20\d{2})\b/i);
  if (named || reversed) {
    const monthText = named?.[2] ?? reversed![1]!;
    const month = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(monthText.slice(0, 3).toLowerCase()) + 1;
    const candidate = `${named?.[3] ?? reversed![3]}-${String(month).padStart(2, '0')}-${(named?.[1] ?? reversed![2]!).padStart(2, '0')}`;
    return isValidIsoDate(candidate) ? candidate : '';
  }
  const numeric = text.match(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](20\d{2})\b/);
  if (!numeric) return '';
  const first = Number(numeric[1]);
  const second = Number(numeric[2]);
  // Ambiguous dates (e.g. 04/05/2026) must be supplied during review.
  if (first <= 12 && second <= 12) return '';
  const day = first > 12 ? first : second;
  const month = first > 12 ? second : first;
  const candidate = `${numeric[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return isValidIsoDate(candidate) ? candidate : '';
}

function readAmount(text: string): number | undefined {
  const matches = text.match(/\d[\d.,]*/g);
  const value = matches?.at(-1);
  if (!value) return undefined;
  const decimalComma = /,\d{2}$/.test(value) && (!value.includes('.') || value.lastIndexOf(',') > value.lastIndexOf('.'));
  const normalized = decimalComma ? value.replace(/\./g, '').replace(',', '.') : value.replace(/,/g, '');
  const number = Number(normalized);
  return Number.isFinite(number) && number > 0 && number < 1e12 ? number : undefined;
}

export function parseReceiptText(rawText: string, document?: ReceiptDocument): ExtractedReceipt {
  if (!rawText.trim()) throw new Error('No readable text was found. Try a clearer image or enter the purchase manually.');
  if (rawText.length > MAX_RECEIPT_TEXT) throw new Error('Receipt text is too large. Use a file under 100,000 characters.');
  const receipt = createManualExtraction(document);
  receipt.rawText = rawText;
  receipt.source = 'receipt';
  receipt.extractionMethod = 'text';
  const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const metadata = /\b(receipt|invoice|tax|gst|vat|address|phone|tel|email|date|time|order|cashier|subtotal|sub total|total|balance|change|cash|card|paid|payment|discount|return|warranty|thank|www|http)\b/i;
  const merchant = lines.find((line) => /[a-z]/i.test(line) && !metadata.test(line) && !/^\d/.test(line) && line.length < 100);
  if (merchant) {
    receipt.merchant = merchant;
    receipt.confidence.merchant = 0.6;
  }
  const purchaseLines = lines.filter((line) => !/return|warranty|expir|due|valid until/i.test(line));
  const dateLine = purchaseLines.find((line) => /(?:purchase|invoice|receipt)?\s*date/i.test(line) && readDate(line)) ?? purchaseLines.find((line) => readDate(line));
  receipt.purchaseDate = dateLine ? readDate(dateLine) : '';
  receipt.confidence.purchaseDate = receipt.purchaseDate ? 0.85 : 0;
  const totalLines = lines.filter((line) => /\b(?:grand\s+total|total\s+(?:amount|paid|due)|amount\s+(?:paid|due)|net\s+(?:total|amount)|total)\b/i.test(line) && !/sub\s*total|tax\s+total|total\s+(?:tax|savings|discount|items|qty|quantity)/i.test(line));
  const preferred = totalLines.find((line) => /grand\s+total|amount\s+paid|total\s+paid/i.test(line)) ?? totalLines.at(-1);
  receipt.total = preferred ? readAmount(preferred) ?? 0 : 0;
  receipt.confidence.total = receipt.total ? 0.85 : 0;
  const currency = rawText.match(/\b(INR|USD|EUR|GBP|CAD|AUD|JPY|CHF|SGD|AED|NZD|SEK|NOK|DKK|ZAR|BRL|MXN|HKD)\b/i)?.[1]?.toUpperCase()
    ?? (rawText.includes('₹') || /\bRs\.?\s*\d/i.test(rawText) ? 'INR' : rawText.includes('€') ? 'EUR' : rawText.includes('£') ? 'GBP' : '');
  receipt.currency = currency;
  receipt.confidence.currency = currency ? 0.9 : 0;
  for (const [field, pattern] of [['returnDeadline', /return\s+(?:by|until|deadline)|last\s+return\s+date/i], ['warrantyExpiry', /warranty\s+(?:until|expiry|expires|end)/i]] as const) {
    const line = lines.find((candidate) => pattern.test(candidate));
    const date = line ? readDate(line) : '';
    receipt[field] = { date, certainty: 'estimated' };
    receipt.confidence[field] = date ? 0.75 : 0;
  }
  const items: LineItem[] = [];
  for (const line of lines) {
    if (line === merchant || metadata.test(line) || readDate(line)) continue;
    const item = line.match(/^([a-z][a-z\d\s&()'./-]{1,90}?)\s+(?:(\d+)\s*[x×]\s*(\d+(?:\.\d{2})?)\s+)?(?:[₹$€£]\s*|(?:INR|USD|EUR|GBP)\s*)?(\d[\d,]*\.\d{2})\s*$/i);
    if (!item) continue;
    const quantity = Number(item[2] ?? 1);
    const total = Number(item[4]!.replace(/,/g, ''));
    if (!(quantity > 0 && total > 0)) continue;
    items.push({ id: `parsed-item-${items.length}`, name: item[1]!.trim(), quantity, unitPrice: item[3] ? Number(item[3]) : total / quantity, total });
  }
  receipt.lineItems = items;
  receipt.productName = items[0]?.name ?? '';
  receipt.confidence.productName = items.length ? 0.7 : 0;
  return receipt;
}

export class ReceiptExtractorService implements ReceiptExtractor {
  constructor(private readonly endpoint = OCR_URL) {}

  async extract(document: ReceiptDocument): Promise<ExtractedReceipt> {
    if (!this.endpoint) throw new Error('Automatic reading is not configured. Enter the receipt details manually or paste receipt text.');
    let endpoint: URL;
    try { endpoint = new URL(this.endpoint); } catch { throw new Error('The receipt reading service address is invalid.'); }
    if (!['http:', 'https:'].includes(endpoint.protocol)) throw new Error('The receipt reading service requires an HTTP or HTTPS address.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    try {
      const body = new FormData();
      if (Platform.OS === 'web') {
        const response = await fetch(document.uri, { signal: controller.signal });
        const blob = await response.blob();
        if (blob.size > MAX_RECEIPT_BYTES) throw new Error('Choose a receipt image smaller than 10 MB.');
        body.append('receipt', blob, document.fileName ?? 'receipt.jpg');
      } else {
        body.append('receipt', { uri: document.uri, name: document.fileName ?? 'receipt.jpg', type: document.mimeType ?? 'image/jpeg' } as unknown as Blob);
      }
      const response = await fetch(`${this.endpoint.replace(/\/$/, '')}/extract`, { method: 'POST', body, signal: controller.signal });
      const result: unknown = await response.json();
      const payload = result && typeof result === 'object' ? result as Record<string, unknown> : {};
      if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : `Receipt reading failed (${response.status}).`);
      if (typeof payload.text !== 'string') throw new Error('The receipt reading service returned an invalid response.');
      const receipt = parseReceiptText(payload.text, document);
      receipt.extractionMethod = 'ocr';
      return receipt;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw new Error('Receipt reading timed out. Try a smaller, clearer image or enter the details manually.');
      if (error instanceof TypeError) throw new Error('Cannot reach the receipt reading service. Check its address and connection, or enter details manually.');
      throw error;
    } finally { clearTimeout(timeout); }
  }
}
