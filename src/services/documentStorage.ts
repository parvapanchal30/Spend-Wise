import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import type { ReceiptDocument } from '@/domain/models';

const MAX_BYTES = 10 * 1024 * 1024;
const directory = () => FileSystem.documentDirectory ? `${FileSystem.documentDirectory}receipts/` : null;

export async function readTextDocument(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    if (blob.size > 100_000) throw new Error('Choose a text receipt smaller than 100 KB.');
    return blob.text();
  }
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || info.isDirectory) throw new Error('The selected document is unavailable. Choose it again.');
  if (info.size > 100_000) throw new Error('Choose a text receipt smaller than 100 KB.');
  return FileSystem.readAsStringAsync(uri);
}

export async function persistDocument(document: ReceiptDocument): Promise<ReceiptDocument> {
  if (Platform.OS === 'web') {
    if (document.uri.startsWith('data:')) {
      if (document.uri.length > Math.ceil(MAX_BYTES * 4 / 3) + 500) throw new Error('Choose a receipt smaller than 10 MB.');
      return document;
    }
    if (!document.uri.startsWith('blob:')) throw new Error('Choose a receipt from this device to attach it.');
    const response = await fetch(document.uri);
    const blob = await response.blob();
    if (blob.size > MAX_BYTES) throw new Error('Choose a receipt smaller than 10 MB.');
    const uri = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not store the receipt.'));
      reader.onerror = () => reject(new Error('Could not store the receipt.'));
      reader.readAsDataURL(blob);
    });
    return { ...document, uri };
  }
  const root = directory();
  if (!root) throw new Error('Document storage is unavailable on this device.');
  if (document.uri.startsWith(root)) return document;
  if (!/^(?:file|content):\/\//.test(document.uri)) throw new Error('Choose a receipt from this device to attach it.');
  const info = await FileSystem.getInfoAsync(document.uri);
  if (!info.exists || info.isDirectory) throw new Error('The receipt file is no longer available. Import it again.');
  if (info.size > MAX_BYTES) throw new Error('Choose a receipt smaller than 10 MB.');
  await FileSystem.makeDirectoryAsync(root, { intermediates: true });
  const extension = document.mimeType === 'text/plain' ? 'txt' : document.mimeType === 'image/png' ? 'png' : document.mimeType === 'image/webp' ? 'webp' : 'jpg';
  const uri = `${root}${document.id.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now()}.${extension}`;
  await FileSystem.copyAsync({ from: document.uri, to: uri });
  return { ...document, uri };
}

export async function removeDocument(document: ReceiptDocument): Promise<void> {
  if (Platform.OS === 'web') return;
  const root = directory();
  // Only delete app-owned receipts, never a user's original photo or document.
  if (root && document.uri.startsWith(root) && !document.uri.slice(root.length).includes('/')) {
    await FileSystem.deleteAsync(document.uri, { idempotent: true });
  }
}

export async function clearDocuments(): Promise<void> {
  if (Platform.OS === 'web') return;
  const root = directory();
  if (root) await FileSystem.deleteAsync(root, { idempotent: true });
}
