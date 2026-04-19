import { Router, Request, Response } from 'express';
import express from 'express';

const router = Router();

router.use(express.json({ limit: '25mb' }));

const PERSON_MAX_BYTES = 10 * 1024 * 1024;
const GARMENT_MAX_BYTES = 5 * 1024 * 1024;
const AI_TIMEOUT_MS = 180_000;

function stripDataUrlPart(s: string): string {
  const t = s.trim();
  const i = t.indexOf(',');
  if (t.startsWith('data:') && i !== -1) return t.slice(i + 1);
  return t;
}

function looksLikeImage(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  if (buf.slice(0, 3).toString('ascii') === 'GIF') return true;
  if (
    buf.slice(0, 4).toString('ascii') === 'RIFF' &&
    buf.slice(8, 12).toString('ascii') === 'WEBP'
  )
    return true;
  return false;
}

function validateBase64Image(
  field: string,
  value: unknown,
  maxBytes: number
): { ok: true } | { ok: false; message: string } {
  if (typeof value !== 'string' || !value.trim()) {
    return { ok: false, message: `${field} is required` };
  }
  const raw = stripDataUrlPart(value);
  const buf = Buffer.from(raw, 'base64');
  if (buf.length === 0) {
    return { ok: false, message: `${field} is not valid base64` };
  }
  if (!looksLikeImage(buf)) {
    return { ok: false, message: `${field} must be a valid image` };
  }
  if (buf.length > maxBytes) {
    return {
      ok: false,
      message: `${field} must not exceed ${maxBytes / (1024 * 1024)}MB`,
    };
  }
  return { ok: true };
}

function checkImageQuality(
  b64: string,
): { ok: true } | { ok: false; message: string } {
  const raw = stripDataUrlPart(b64);
  const buf = Buffer.from(raw, 'base64');

  const isPng =
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;

  let width = 0;
  let height = 0;

  if (isPng && buf.length >= 24) {
    width = buf.readUInt32BE(16);
    height = buf.readUInt32BE(20);
  } else if (isJpeg) {
    let offset = 2;
    while (offset < buf.length - 8) {
      if (buf[offset] !== 0xff) break;
      const marker = buf[offset + 1];
      if (marker === 0xc0 || marker === 0xc2) {
        height = buf.readUInt16BE(offset + 5);
        width = buf.readUInt16BE(offset + 7);
        break;
      }
      const segLen = buf.readUInt16BE(offset + 2);
      offset += 2 + segLen;
    }
  }

  if (width > 0 && height > 0 && (width < 400 || height < 400)) {
    return {
      ok: false,
      message: `Image resolution too low (${width}x${height}). Minimum 400x400 required.`,
    };
  }

  if (isJpeg || isPng) {
    const sampleSize = Math.min(buf.length, 50000);
    const start = isPng ? 50 : 2;
    let sum = 0;
    let count = 0;
    for (let i = start; i < sampleSize; i++) {
      sum += buf[i];
      count++;
    }
    if (count > 0) {
      const avg = sum / count;
      if (avg < 40) {
        return {
          ok: false,
          message: 'Image too dark. Please use better lighting.',
        };
      }
    }
  }

  return { ok: true };
}

router.post('/tryon', async (req: Request, res: Response) => {
  const person = validateBase64Image('person_image', req.body?.person_image, PERSON_MAX_BYTES);
  if (!person.ok) return res.status(400).json({ message: person.message });

  const garment = validateBase64Image(
    'garment_image',
    req.body?.garment_image,
    GARMENT_MAX_BYTES
  );
  if (!garment.ok) return res.status(400).json({ message: garment.message });

  const quality = checkImageQuality(req.body.person_image);
  if (!quality.ok) return res.status(400).json({ message: quality.message });

  const category =
    typeof req.body?.category === 'string' && req.body.category.trim()
      ? req.body.category
      : 'upper_body';

  const modalUrl = process.env.MODAL_AI_URL?.trim();
  if (!modalUrl) {
    return res.status(500).json({ message: 'MODAL_AI_URL is not configured' });
  }

  const body = JSON.stringify({
    person_image: req.body.person_image,
    garment_image: req.body.garment_image,
    category,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const aiRes = await fetch(modalUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    });

    if (aiRes.status === 503) {
      const detail = await aiRes.text();
      return res.status(503).json({
        error: 'AI service unavailable',
        detail: detail.slice(0, 500) || 'Service temporarily unavailable',
      });
    }

    if (!aiRes.ok) {
      const detail = await aiRes.text();
      return res.status(502).json({
        error: 'AI service error',
        detail: detail.slice(0, 500) || `HTTP ${aiRes.status}`,
      });
    }

    const data = (await aiRes.json()) as {
      result_image?: string;
      preprocessed_image?: string;
      raw_model_image?: string;
      preprocessed_person?: string;
      preprocessed_garment?: string;
      raw_result?: string;
      processing_time?: number;
    };
    if (typeof data.result_image !== 'string' || !data.result_image) {
      return res.status(502).json({
        error: 'AI service error',
        detail: 'Invalid response from AI service',
      });
    }

    return res.json({
      result_image: data.result_image,
      preprocessed_image: data.preprocessed_image ?? null,
      raw_model_image: data.raw_model_image ?? null,
      preprocessed_person: data.preprocessed_person ?? null,
      preprocessed_garment: data.preprocessed_garment ?? null,
      raw_result: data.raw_result ?? null,
      processing_time:
        typeof data.processing_time === 'number' ? data.processing_time : 0,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return res.status(504).json({ error: 'AI service timeout' });
    }
    return res.status(502).json({
      error: 'AI service error',
      detail: err instanceof Error ? err.message : String(err),
    });
  } finally {
    clearTimeout(timeoutId);
  }
});

export default router;
