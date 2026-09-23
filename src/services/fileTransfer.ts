import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';

const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

export async function pickTextFile(): Promise<{ name: string; text: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    // Banks often label CSV downloads as application/octet-stream or a custom MIME type.
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) throw new Error('No file was selected.');
  if ((asset.size ?? asset.file?.size ?? 0) > MAX_IMPORT_BYTES) throw new Error('Choose a file smaller than 10 MB.');
  let text: string;
  if (Platform.OS === 'web') {
    if (!asset.file) throw new Error('This browser could not read the selected file.');
    text = await asset.file.text();
  } else {
    const { File } = await import('expo-file-system');
    const file = new File(asset.uri);
    if ((file.size ?? 0) > MAX_IMPORT_BYTES) throw new Error('Choose a file smaller than 10 MB.');
    text = await file.text();
  }
  if (text.length > MAX_IMPORT_BYTES) throw new Error('Choose a file smaller than 10 MB.');
  if (text.includes('\0')) throw new Error('Choose a UTF-8 CSV or SpendWise JSON text file.');
  return { name: asset.name, text };
}

export async function shareTextFile(name: string, text: string, mimeType: string): Promise<void> {
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (Platform.OS === 'web') {
    const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = safeName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const [{ File, Paths }, Sharing] = await Promise.all([
    import('expo-file-system'),
    import('expo-sharing'),
  ]);
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('File sharing is not available on this device.');
  }
  const file = new File(Paths.cache, safeName);
  try {
    file.write(text);
    await Sharing.shareAsync(file.uri, {
      mimeType,
      dialogTitle: `Export ${safeName}`,
      UTI: mimeType === 'text/calendar' ? 'public.calendar-event' : mimeType === 'text/csv' ? 'public.comma-separated-values-text' : 'public.json',
    });
  } finally {
    if (file.exists) file.delete();
  }
}
