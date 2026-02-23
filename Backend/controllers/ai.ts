import { Request, Response } from 'express';
import { HTTP_STATUS } from '../constants/errorCodes.js';

const MAX_DESCRIPTION_LENGTH = 300;

/**
 * POST /api/ai/suggest-description
 * Calls local Ollama (or compatible) API to generate a minimal description.
 * Requires ai.suggest permission (admin). Body: { context: string, name: string, optionalKeywords?: string }
 */
export const suggestDescription = async (req: Request, res: Response): Promise<Response> => {
  try {
    const baseUrl = process.env.AI_SERVICE_URL;
    const model = process.env.AI_MODEL || 'tinyllama';

    if (!baseUrl || typeof baseUrl !== 'string') {
      return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        message: 'AI suggestion service is not configured (AI_SERVICE_URL)',
      });
    }

    if (!req.body || typeof req.body !== 'object') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Request body is required',
      });
    }

    const { context = 'Item', name, optionalKeywords } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'name is required and must be a non-empty string',
      });
    }

    const prompt = [
      `Write a minimal, relevant description in 1-2 sentences for a ${String(context).trim()} named "${name.trim()}".`,
      optionalKeywords && typeof optionalKeywords === 'string' && optionalKeywords.trim()
        ? `Include these ideas if relevant: ${optionalKeywords.trim()}.`
        : '',
      'No marketing fluff. Output only the description text, nothing else.',
    ]
      .filter(Boolean)
      .join(' ');

    const url = `${baseUrl.replace(/\/$/, '')}/api/generate`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s

    const ollamaRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!ollamaRes.ok) {
      const text = await ollamaRes.text();
      console.error('Ollama error:', ollamaRes.status, text);
      return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        message: 'AI service returned an error. Ensure the model is pulled (e.g. ollama pull tinyllama).',
      });
    }

    const data = (await ollamaRes.json()) as { response?: string };
    let suggestion = typeof data.response === 'string' ? data.response.trim() : '';

    if (!suggestion) {
      return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        message: 'AI service returned no text',
      });
    }

    if (suggestion.length > MAX_DESCRIPTION_LENGTH) {
      suggestion = suggestion.slice(0, MAX_DESCRIPTION_LENGTH).trim();
      const lastSpace = suggestion.lastIndexOf(' ');
      if (lastSpace > MAX_DESCRIPTION_LENGTH / 2) suggestion = suggestion.slice(0, lastSpace);
    }

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { suggestion },
    });
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
          success: false,
          message: 'AI service request timed out',
        });
      }
      const cause = (err as Error & { cause?: { code?: string } }).cause;
      if (cause && typeof cause.code === 'string' && (cause.code === 'ECONNREFUSED' || cause.code === 'ENOTFOUND')) {
        return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
          success: false,
          message: 'AI service is not reachable. Is Ollama running?',
        });
      }
    }
    console.error('suggestDescription error:', err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get suggestion',
    });
  }
};

const MAX_TAGS_LENGTH = 200;

/**
 * POST /api/ai/suggest-tags
 * Suggests product tags (comma-separated) based on name, description, category.
 * Requires ai.suggest permission (admin). Body: { name?: string, description?: string, categoryName?: string }
 */
export const suggestTags = async (req: Request, res: Response): Promise<Response> => {
  try {
    const baseUrl = process.env.AI_SERVICE_URL;
    const model = process.env.AI_MODEL || 'tinyllama';

    if (!baseUrl || typeof baseUrl !== 'string') {
      return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        message: 'AI suggestion service is not configured (AI_SERVICE_URL)',
      });
    }

    if (!req.body || typeof req.body !== 'object') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Request body is required',
      });
    }

    const { name = '', description = '', categoryName = '' } = req.body;
    const nameStr = typeof name === 'string' ? name.trim() : '';
    const descStr = typeof description === 'string' ? description.trim().slice(0, 500) : '';
    const catStr = typeof categoryName === 'string' ? categoryName.trim() : '';

    const prompt = [
      'Suggest 3 to 6 short product tags (e.g. New, Trending, Best Seller, Sale) for an e-commerce product.',
      nameStr ? `Product name: ${nameStr}.` : '',
      catStr ? `Category: ${catStr}.` : '',
      descStr ? `Description (excerpt): ${descStr.slice(0, 300)}.` : '',
      'Output only a comma-separated list of tags, no numbering or explanation. Example: New, Trending, Popular',
    ]
      .filter(Boolean)
      .join(' ');

    const url = `${baseUrl.replace(/\/$/, '')}/api/generate`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    const ollamaRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!ollamaRes.ok) {
      const text = await ollamaRes.text();
      console.error('Ollama suggest-tags error:', ollamaRes.status, text);
      return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        message: 'AI service returned an error.',
      });
    }

    const data = (await ollamaRes.json()) as { response?: string };
    let raw = typeof data.response === 'string' ? data.response.trim() : '';

    if (!raw) {
      return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        message: 'AI service returned no text',
      });
    }

    const tags = raw
      .split(/[,;|\n]/)
      .map((s) => s.trim().replace(/^[-.\d\s]+/, '').trim())
      .filter(Boolean)
      .slice(0, 8);
    const suggestion = tags.join(', ');
    const result = suggestion.slice(0, MAX_TAGS_LENGTH);

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { suggestion: result },
    });
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
          success: false,
          message: 'AI service request timed out',
        });
      }
      const cause = (err as Error & { cause?: { code?: string } }).cause;
      if (cause && typeof cause.code === 'string' && (cause.code === 'ECONNREFUSED' || cause.code === 'ENOTFOUND')) {
        return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
          success: false,
          message: 'AI service is not reachable.',
        });
      }
    }
    console.error('suggestTags error:', err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get tag suggestion',
    });
  }
};
