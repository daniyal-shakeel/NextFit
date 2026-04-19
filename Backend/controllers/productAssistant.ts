import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Category from '../models/Category.js';
import { groqCompleteJson } from '../services/groqService.js';

type CategoryDoc = { _id: mongoose.Types.ObjectId; name: string; slug: string };

function isValidHttpOrHttpsUrl(s: string): boolean {
  try {
    const u = new URL(s.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function coercePrice(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (Number.isNaN(n) || !Number.isFinite(n)) return null;
  return n;
}

function coerceReviewCount(raw: unknown): number | null {
  if (raw === null || raw === undefined) return 0;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (Number.isNaN(n) || !Number.isFinite(n) || n < 0) return null;
  return Math.max(0, Math.floor(n));
}

function normalizeImagesField(raw: unknown): string[] {
  if (raw === null || raw === undefined) return [];
  if (typeof raw === 'string') {
    const t = raw.trim();
    return t && isValidHttpOrHttpsUrl(t) ? [t.trim()] : [];
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === 'string')
    .map((s) => s.trim())
    .filter((s) => s && isValidHttpOrHttpsUrl(s));
}

function normalizeStringArray(raw: unknown): string[] {
  if (raw === null || raw === undefined) return [];
  if (typeof raw === 'string') {
    return raw
      .split(/[\n,]/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === 'string')
    .map((s) => s.trim())
    .filter(Boolean);
}

function resolveCategory(
  raw: unknown,
  categories: CategoryDoc[]
): { id: string; name: string } | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (mongoose.isValidObjectId(s)) {
    const hit = categories.find((c) => c._id.toString() === s);
    if (hit) return { id: hit._id.toString(), name: hit.name };
  }
  const lower = s.toLowerCase();
  const byName = categories.find((c) => c.name.trim().toLowerCase() === lower);
  if (byName) return { id: byName._id.toString(), name: byName.name };
  const bySlug = categories.find((c) => c.slug.trim().toLowerCase() === lower);
  if (bySlug) return { id: bySlug._id.toString(), name: bySlug.name };
  return null;
}

function buildMainAndSecondaries(args: {
  mainImageUrl: unknown;
  images: unknown;
}): { main: string | null; secondaryList: string[] } {
  let main: string | null = null;
  if (typeof args.mainImageUrl === 'string' && args.mainImageUrl.trim()) {
    const t = args.mainImageUrl.trim();
    main = isValidHttpOrHttpsUrl(t) ? t : null;
  }
  const fromImages = normalizeImagesField(args.images);
  if (!main && fromImages.length > 0) {
    main = fromImages[0] ?? null;
  }
  const secondaryPool =
    main && fromImages.length > 0 && fromImages[0] === main ? fromImages.slice(1) : [...fromImages];
  const secondaryList: string[] = [];
  for (const u of secondaryPool) {
    if (secondaryList.length >= 3) break;
    if (u !== main) secondaryList.push(u);
  }
  return { main, secondaryList };
}

function padImageUrls(main: string, secondaryList: string[]): [string, string, string] {
  const s = [...secondaryList];
  while (s.length < 3) s.push(main);
  return [s[0]!, s[1]!, s[2]!];
}

export type AssistantDraftProduct = {
  name: string;
  description: string | null;
  categoryId: string;
  categoryName: string;
  basePrice: number;
  mainImageUrl: string;
  imageUrls: [string, string, string];
  rating: number | null;
  reviewCount: number;
  features: string[];
  tags: string[];
};
    
export const productAssistantDraft = async (req: Request, res: Response): Promise<Response> => {
  const message =
    req.body && typeof req.body === 'object' && typeof req.body.message === 'string'
      ? req.body.message.trim()
      : '';

  if (!message) {
    return res.status(200).json({
      success: false,
      error: 'EMPTY_INPUT',
      message: 'Please describe the product(s) you want to add.',
    });
  }

  let categories: CategoryDoc[];
  try {
    categories = (await Category.find().lean()) as CategoryDoc[];
  } catch (e) {
    console.error('productAssistantDraft category load:', e);
    return res.status(200).json({
      success: false,
      error: 'GROQ_API_ERROR',
      message: 'AI service unavailable. Try again.',
    });
  }

  const categoryJson = categories.map((c) => ({
    id: c._id.toString(),
    name: c.name,
    slug: c.slug,
  }));

  const systemPrompt = `You extract product listings from natural language for an e-commerce admin API.
Return ONLY a valid JSON array. No markdown, no code fences, no commentary before or after the JSON.

Each array element is one product object with exactly these keys:
- "name": string or null
- "basePrice": number or null (price in the store's currency; use null if unknown)
- "price": number or null (alias for basePrice if you prefer; use null if unknown)
- "category": string or null — must be one of the allowed category "id" OR "name" OR "slug" strings below, or null if unknown
- "description": string or null
- "rating": number or null (must be between 0 and 5 inclusive, or null)
- "reviewCount": number or null (non-negative integer count of reviews; use null if unknown)
- "mainImageUrl": string or null (http(s) image URL, or null)
- "images": string OR array of strings OR null — extra image URLs (http(s) only); optional
- "features": array of strings OR null
- "tags": array of strings OR null

Rules:
- If any value cannot be inferred from the user message, set that key to null (never guess category names outside the allowed list).
- Do not output NaN or Infinity.
- Return an empty array [] if the user message does not describe any products.

Allowed categories (JSON):
${JSON.stringify(categoryJson, null, 0)}`;

  const groqResult = await groqCompleteJson({
    systemPrompt,
    userMessage: message,
  });
  console.log('groqResult', groqResult);

  if (!groqResult.ok) {
    if (groqResult.code === 'RATE_LIMIT') {
      return res.status(200).json({
        success: false,
        error: 'RATE_LIMIT',
        message: 'Too many requests. Wait a moment and try again.',
      });
    }
    if (groqResult.code === 'PARSE_ERROR') {
      return res.status(200).json({
        success: false,
        error: 'PARSE_ERROR',
        message: 'AI could not understand the input. Please be more specific.',
      });
    }
    return res.status(200).json({
      success: false,
      error: 'GROQ_API_ERROR',
      message: 'AI service unavailable. Try again.',
    });
  }

  const rawData = groqResult.data;
  let items: unknown[];
  if (Array.isArray(rawData)) {
    items = rawData;
  } else if (rawData !== null && typeof rawData === 'object') {
    items = [rawData];
  } else {
    return res.status(200).json({
      success: false,
      error: 'PARSE_ERROR',
      message: 'AI could not understand the input. Please be more specific.',
    });
  }

  if (items.length === 0) {
    return res.status(200).json({
      success: false,
      error: 'PARSE_ERROR',
      message: 'AI could not understand the input. Please be more specific.',
    });
  }

  const missingFields = new Set<string>();
  const products: AssistantDraftProduct[] = [];

  for (const item of items) {
    const rowIssues = new Set<string>();

    if (item === null || typeof item !== 'object') {
      rowIssues.add('name');
      rowIssues.add('basePrice');
      rowIssues.add('category');
      rowIssues.add('images');
      rowIssues.forEach((f) => missingFields.add(f));
      continue;
    }

    const o = item as Record<string, unknown>;

    const name = typeof o.name === 'string' ? o.name.trim() : null;
    if (!name) rowIssues.add('name');

    const priceRaw = o.basePrice !== undefined && o.basePrice !== null ? o.basePrice : o.price;
    const price = coercePrice(priceRaw);
    if (price === null || price <= 0) rowIssues.add('basePrice');

    const cat = resolveCategory(o.category, categories);
    if (!cat) rowIssues.add('category');

    let rating: number | null = null;
    if (o.rating !== undefined && o.rating !== null) {
      const r = coercePrice(o.rating);
      if (r === null || r < 0 || r > 5) rowIssues.add('rating');
      else rating = r;
    }

    let reviewCount = 0;
    if (o.reviewCount !== undefined && o.reviewCount !== null) {
      const rc = coerceReviewCount(o.reviewCount);
      if (rc === null) rowIssues.add('reviewCount');
      else reviewCount = rc;
    }

    const description: string | null =
      typeof o.description === 'string' && o.description.trim() ? o.description.trim() : null;

    const { main, secondaryList } = buildMainAndSecondaries({
      mainImageUrl: o.mainImageUrl,
      images: o.images,
    });
    if (!main) rowIssues.add('images');

    const tagList = normalizeStringArray(o.tags);
    const featureList = normalizeStringArray(o.features);

    if (rowIssues.size > 0) {
      rowIssues.forEach((f) => missingFields.add(f));
      continue;
    }

    if (name && price !== null && price > 0 && cat && main) {
      const imageUrls = padImageUrls(main, secondaryList);
      products.push({
        name,
        description,
        categoryId: cat.id,
        categoryName: cat.name,
        basePrice: price,
        mainImageUrl: main,
        imageUrls,
        rating,
        reviewCount,
        features: featureList,
        tags: tagList,
      });
    }
  }

  if (missingFields.size > 0) {
    const fields = [...missingFields].sort();
    return res.status(200).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: `Some fields are missing: ${fields.join(', ')}. Edit them in the preview before confirming.`,
      fields,
    });
  }

  return res.status(200).json({
    success: true,
    products,
  });
};
