import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import Busboy from 'busboy';

const DEFAULT_LIMIT = 10 * 1024 * 1024;
const DEFAULT_ORIGINS = ['http://localhost:8081', 'http://127.0.0.1:8081', 'http://localhost:19006'];

class RequestError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

function send(response, status, value) {
  if (response.destroyed || response.writableEnded) return;
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(value));
}

function imageType(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'image/jpeg';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

function receiveImage(request, maxBytes, signal) {
  return new Promise((resolve, reject) => {
    if (Number(request.headers['content-length']) > maxBytes + 64 * 1024) return reject(new RequestError('Choose a receipt image smaller than 10 MB.', 413));
    let parser;
    try { parser = Busboy({ headers: request.headers, limits: { fileSize: maxBytes } }); }
    catch { reject(new RequestError('Upload one image as a multipart receipt field.')); return; }
    let buffer;
    let failure;
    let bytes = 0;
    let fileCount = 0;
    signal.addEventListener('abort', () => {
      request.unpipe(parser);
      parser.destroy(new RequestError('Image upload timed out.', 408));
      request.resume();
    }, { once: true });
    const recordFailure = (message, status = 400) => { failure ??= new RequestError(message, status); };
    const onData = (chunk) => {
      bytes += chunk.length;
      if (bytes > maxBytes + 64 * 1024) {
        request.unpipe(parser);
        parser.destroy(new RequestError('Choose a receipt image smaller than 10 MB.', 413));
        request.resume();
      }
    };
    request.on('data', onData);
    request.once('aborted', () => parser.destroy(new RequestError('Upload was cancelled.')));
    parser.on('file', (name, file, info) => {
      fileCount += 1;
      const chunks = [];
      if (fileCount > 1) recordFailure('Upload one receipt at a time.');
      if (name !== 'receipt' || !['image/png', 'image/jpeg', 'image/webp'].includes(info.mimeType)) recordFailure('Use a PNG, JPEG, or WebP receipt image.', 415);
      file.on('limit', () => recordFailure('Choose a receipt image smaller than 10 MB.', 413));
      file.on('data', (chunk) => { if (!failure) chunks.push(chunk); });
      file.on('end', () => { buffer = Buffer.concat(chunks); });
      file.on('error', reject);
    });
    parser.on('field', () => recordFailure('Only a receipt image is accepted.'));
    parser.on('error', (error) => { request.removeListener('data', onData); reject(error instanceof RequestError ? error : new RequestError('The image upload is incomplete.')); });
    parser.on('close', () => {
      request.removeListener('data', onData);
      if (failure) return reject(failure);
      if (!buffer?.length) return reject(new RequestError('No image was uploaded.'));
      if (!imageType(buffer)) return reject(new RequestError('This file is not a supported image.', 415));
      resolve(buffer);
    });
    request.pipe(parser);
  });
}

export function createReceiptServer({ recognize, cancel = async () => {}, origins = DEFAULT_ORIGINS, maxBytes = DEFAULT_LIMIT, timeoutMs = 90_000 } = {}) {
  if (typeof recognize !== 'function') throw new Error('A receipt recognizer is required.');
  let processing = false;
  const server = http.createServer(async (request, response) => {
    const origin = request.headers.origin;
    if (origin && !origins.includes(origin)) return send(response, 403, { error: 'This app origin is not allowed by the receipt reading service.' });
    if (origin) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
    if (request.url === '/health' && request.method === 'GET') return send(response, 200, { status: 'ok', engine: 'tesseract', busy: processing });
    if (request.url !== '/extract') return send(response, 404, { error: 'Not found.' });
    if (request.method !== 'POST') return send(response, 405, { error: 'Use POST to read a receipt.' });
    if (processing) return send(response, 429, { error: 'The receipt reader is busy. Please try again shortly.' });
    processing = true;
    let timer;
    const uploadController = new AbortController();
    try {
      const uploadTimeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new RequestError('Image upload timed out.', 408)), 15_000); });
      const image = await Promise.race([receiveImage(request, maxBytes, uploadController.signal), uploadTimeout]);
      clearTimeout(timer);
      const recognitionTimeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new RequestError('Receipt reading timed out. Try a clearer image or enter details manually.', 504)), timeoutMs); });
      const result = await Promise.race([recognize(image), recognitionTimeout]);
      const text = typeof result === 'string' ? result : result?.text;
      if (typeof text !== 'string' || !text.trim()) throw new RequestError('No readable text was found. Try a clearer image or enter details manually.', 422);
      if (text.length > 100_000) throw new RequestError('The receipt contains too much text. Choose a smaller image.', 422);
      send(response, 200, { text, engine: 'tesseract' });
    } catch (error) {
      if (error instanceof RequestError && error.status === 408) uploadController.abort();
      if (error instanceof RequestError && error.status === 504) await cancel();
      send(response, error instanceof RequestError ? error.status : 422, { error: error instanceof RequestError ? error.message : 'The image could not be read. Try a clear PNG or JPEG receipt.' });
      request.resume();
    } finally { clearTimeout(timer); processing = false; }
  });
  server.requestTimeout = 20_000;
  server.headersTimeout = 10_000;
  return server;
}

export async function createTesseractRecognizer() {
  const { createWorker } = await import('tesseract.js');
  let worker;
  let generation = 0;
  return {
    recognize: async (buffer) => {
      if (!worker) {
        const started = generation;
        const candidate = await createWorker(process.env.OCR_LANGUAGE || 'eng', undefined, { errorHandler: () => {} });
        if (generation !== started) { await candidate.terminate(); throw new Error('Reading was cancelled.'); }
        worker = candidate;
      }
      const result = await worker.recognize(buffer);
      return { text: result.data.text };
    },
    cancel: async () => {
      generation += 1;
      const active = worker;
      worker = undefined;
      if (active) await active.terminate();
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const recognizer = await createTesseractRecognizer();
  const origins = process.env.OCR_ALLOWED_ORIGINS ? process.env.OCR_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean) : DEFAULT_ORIGINS;
  const server = createReceiptServer({ ...recognizer, origins });
  const host = process.env.OCR_HOST || '127.0.0.1';
  const port = Number(process.env.OCR_PORT || 8787);
  server.listen(port, host, () => console.log(`SpendWise receipt reader listening at http://${host}:${port}`));
  const close = () => server.close(async () => { await recognizer.cancel(); process.exit(0); });
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
}
