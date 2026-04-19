import { Request, Response } from 'express';
import { HTTP_STATUS } from '../constants/errorCodes.js';
import { getOrCreateAdminSettings } from '../services/adminSettingsService.js';
import { groqCompleteText, type GroqTextResult } from '../services/groqService.js';

const MAX_DESCRIPTION_LENGTH = 900;
/** Groq output budget (tokens), aligned with former local LLM prediction lengths */
const GROQ_MAX_TOKENS_DESCRIPTION = 900;
const GROQ_MAX_TOKENS_TAGS = 450;
const GROQ_MAX_TOKENS_FEATURES = 650;
const MAX_TAG_CHARS = 22;
const FEATURE_LINE_MIN = 40;
const FEATURE_LINE_MAX = 50;
const MIN_FEATURE_LINES = 5;

const FEATURE_FALLBACKS: string[] = [
  'Soft cotton blend feels great on skin all day.',
  'Tailored fit flatters without feeling too tight.',
  'Machine wash cold; colors stay bright over time.',
  'Pairs easily with jeans, skirts, or layered looks.',
  'Durable seams hold their shape through daily wear.',
  'Light weave keeps you cool in warm weather.',
];

function isGroqConfigured(): boolean {
  return Boolean(process.env.NEXTFIT_ADMIN_CONSOLE_API_KEY_GROQ?.trim());
}

function respondGroqFailure(res: Response, result: Extract<GroqTextResult, { ok: false }>): Response {
  if (result.code === 'RATE_LIMIT') {
    return res.status(429).json({
      success: false,
      message: result.message,
    });
  }
  return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
    success: false,
    message: result.message,
  });
}

const ADMIN_AI_SYSTEM_BASE =
  'You help NextFit admins write storefront listings. Follow the user instructions exactly. Reply with plain text only — no preamble, no markdown fences.';

function buildCompactListingBlock(
  title: string,
  department: string,
  opts: { themes?: string; notes?: string; assumePhoto?: boolean }
): string {
  const lines = [`Listing title — ${title.trim()}`, `Store section — ${department.trim() || 'general'}`];
  if (opts.themes?.trim()) {
    lines.push(`Themes to reflect (do not quote): ${opts.themes.trim().slice(0, 200)}`);
  }
  if (opts.notes?.trim()) {
    lines.push(`Existing copy hints (rewrite in your own words): ${opts.notes.trim().slice(0, 320)}`);
  }
  if (opts.assumePhoto) {
    lines.push('Assume a clear main product photo is shown (never paste links or say "URL").');
  }
  return lines.join('\n');
}

const DESC_LABEL_STRIP =
  /\b(?:Product\s*Name|Category|Primary\s+Product\s+Image\s*URL|Additional\s+Themes|Sentences)\s*:\s*/gi;

function stripEchoFromDescription(raw: string): string {
  let t = raw.replace(/\s+/g, ' ').trim();

  const sentMatch = t.match(/\bSentences\s*:\s*(.+)$/i);
  if (sentMatch) {
    t = sentMatch[1].trim();
  }

  const numbered = t
    .split(/\s*\d+\.\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const usable = numbered.filter((p) => {
    if (p.length < 18) return false;
    if (/product\s*name|category:|primary\s+.*image|additional\s+themes|https?:\/\//i.test(p)) return false;
    return true;
  });
  if (usable.length >= 1) {
    t = usable.join(' ');
  }

  for (let i = 0; i < 10; i++) {
    const before = t;
    t = t.replace(DESC_LABEL_STRIP, '').trim();
    t = t.replace(/^https?:\/\/\S+\s*/i, '').trim();
    t = t.replace(/\s+https?:\/\/\S+/g, '').trim();
    if (t === before) break;
  }

  t = t.replace(DESC_LABEL_STRIP, '');
  t = t.replace(/https?:\/\/\S+/g, '');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

function normalizeDescription(raw: string): string {
  let suggestion = stripEchoFromDescription(raw);
  suggestion = suggestion.replace(/^["']|["']$/g, '').trim();
  suggestion = suggestion.replace(/\s+/g, ' ');
  if (suggestion.length > MAX_DESCRIPTION_LENGTH) {
    const chunk = suggestion.slice(0, MAX_DESCRIPTION_LENGTH);
    const punct = ['. ', '! ', '? '];
    let best = -1;
    for (const p of punct) {
      const idx = chunk.lastIndexOf(p);
      if (idx > MAX_DESCRIPTION_LENGTH * 0.45 && idx > best) best = idx;
    }
    const single = Math.max(chunk.lastIndexOf('.'), chunk.lastIndexOf('!'), chunk.lastIndexOf('?'));
    const cut = best >= 0 ? best + 1 : single > MAX_DESCRIPTION_LENGTH * 0.45 ? single + 1 : MAX_DESCRIPTION_LENGTH;
    suggestion = chunk.slice(0, cut).trim();
  }
  if (suggestion && !/[.!?]$/.test(suggestion)) {
    suggestion = `${suggestion}.`;
  }
  suggestion = suggestion.replace(DESC_LABEL_STRIP, '').replace(/https?:\/\/\S+/g, '');
  suggestion = suggestion.replace(/\s+/g, ' ').trim();
  if (suggestion && !/[.!?]$/.test(suggestion)) {
    suggestion = `${suggestion}.`;
  }
  return suggestion;
}

const MAX_TAG_WORDS = 3;
const TAG_NOISE_SUBSTR = /(http|www\.|:\/\/|product\s+name|primary\s+product|primary\s+image|current\s+description|description\s+draft|image\s+url)/i;

function tagWordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function cleanTagCandidate(raw: string): string | null {
  let t = raw
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/^#+/, '')
    .replace(/^[\d.)]+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return null;

  const colon = t.indexOf(':');
  if (colon > 0 && colon < 28) {
    const label = t.slice(0, colon).trim().toLowerCase();
    const rest = t.slice(colon + 1).trim();
    if (/^(product name|category|department)$/i.test(label) && rest) {
      t = rest;
    } else if (
      /^(primary|current|description|image|listing|sku)$/i.test(label) ||
      label.includes('product') && label.includes('image')
    ) {
      return null;
    }
  }

  if (t.includes(':')) return null;
  if (t.length > MAX_TAG_CHARS) {
    const cut = t.slice(0, MAX_TAG_CHARS);
    const sp = cut.lastIndexOf(' ');
    t = sp > 6 ? cut.slice(0, sp).trim() : cut.trim();
  }
  return t || null;
}

function isValidShoppingTag(t: string): boolean {
  if (!t || t.length < 2 || t.length > MAX_TAG_CHARS) return false;
  if (tagWordCount(t) > MAX_TAG_WORDS) return false;
  if (TAG_NOISE_SUBSTR.test(t)) return false;
  if (/^(this|its)\s+/i.test(t)) return false;
  if (/^(product|category|primary|current|description|image|listing|department|sku)\b/i.test(t)) return false;
  if (/^(the|a|an)\s+/i.test(t) && t.length > 20) return false;
  if (/\b(offers|draft)\b/i.test(t) && t.length > 12) return false;
  return true;
}

function deriveTagsFromNameAndCategory(name: string, category: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw: string) => {
    const t = cleanTagCandidate(raw);
    if (!t || !isValidShoppingTag(t)) return;
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t);
  };

  if (category) {
    const cat = category.trim().split(/\s+/).slice(0, 2).join(' ');
    if (cat.length >= 2 && cat.length <= MAX_TAG_CHARS) add(cat);
  }

  const stop = new Set([
    'the',
    'and',
    'for',
    'with',
    'this',
    'that',
    'from',
    'new',
    'its',
    'are',
    'our',
    'your',
  ]);
  const words = name
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stop.has(w.toLowerCase()));

  for (const w of words) {
    const cap = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    if (cap.length <= MAX_TAG_CHARS) add(cap);
    if (out.length >= 8) break;
  }

  return out;
}

function normalizeTags(raw: string, nameStr: string, catStr: string): string {
  const parts = raw.split(/[,;|\n]/).map((s) => cleanTagCandidate(s)).filter((x): x is string => Boolean(x));

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const t of parts) {
    if (!isValidShoppingTag(t)) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(t);
    if (unique.length >= 8) break;
  }

  for (const t of deriveTagsFromNameAndCategory(nameStr, catStr)) {
    if (unique.length >= 8) break;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(t);
  }

  const fallbackTags = ['Casual Wear', 'Wardrobe Staple', 'Gift Ready', 'Daily Wear', 'Shop Favorite', 'New In'];
  for (const ft of fallbackTags) {
    if (unique.length >= 5) break;
    const t = ft.length > MAX_TAG_CHARS ? ft.slice(0, MAX_TAG_CHARS).trim() : ft;
    const key = t.toLowerCase();
    if (!seen.has(key) && isValidShoppingTag(t)) {
      seen.add(key);
      unique.push(t);
    }
  }

  return unique.slice(0, 8).join(', ');
}

function isFeatureNoiseLine(line: string): boolean {
  const l = line.trim();
  if (!l) return true;
  const lower = l.toLowerCase();
  if (/^product\s*name\s*:/i.test(l)) return true;
  if (/^category\s*:/i.test(l)) return true;
  if (/^primary\s+/i.test(l) && /image|url|photo/i.test(l)) return true;
  if (/^each line must\b/i.test(lower)) return true;
  if (/^no numbering\b/i.test(lower)) return true;
  if (/^no dashes\b/i.test(lower)) return true;
  if (/complete english phrase/i.test(lower)) return true;
  if (/must be concise\b/i.test(lower)) return true;
  if (/^the product name must\b/i.test(lower)) return true;
  if (/^output only\b/i.test(lower)) return true;
  if (/^rules?\s*:/i.test(l)) return true;
  if (/https?:\/\//i.test(l)) return true;
  if (/listing title\s*[—–-]/i.test(l)) return true;
  if (/store section\s*[—–-]/i.test(l)) return true;
  if (/themes to reflect/i.test(lower)) return true;
  if (/existing copy hints/i.test(lower)) return true;
  if (/assume a clear main product photo/i.test(lower)) return true;
  if (lower.length < 20 && /^(each|no |do not|write |list )/i.test(l)) return true;
  return false;
}

function stripFeatureNoise(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map((ln) => ln.trim())
    .filter((ln) => !isFeatureNoiseLine(ln))
    .join('\n');
}

function splitFeatureCandidates(raw: string): string[] {
  const out: string[] = [];
  for (const block of raw.split(/\r?\n/)) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const pieces = trimmed.includes('. ')
      ? trimmed.split(/\.\s+/).map((p) => p.replace(/\.$/, '').trim()).filter(Boolean)
      : [trimmed.replace(/\.$/, '').trim()];
    for (const p of pieces) {
      if (p) out.push(p);
    }
  }
  return out;
}

function fitFeatureLine(raw: string): string | null {
  let s = raw.replace(/\s+/g, ' ').trim().replace(/^[-•*\d.)]+\s*/, '');
  if (!s) return null;
  s = s.replace(/[,;:]$/, '').trim();

  const inRange = (t: string) =>
    t.length >= FEATURE_LINE_MIN && t.length <= FEATURE_LINE_MAX;

  if (inRange(s)) return s;

  if (s.length < FEATURE_LINE_MIN) return null;

  if (s.length > FEATURE_LINE_MAX) {
    const words = s.split(/\s+/);
    let acc = '';
    for (const w of words) {
      const next = acc ? `${acc} ${w}` : w;
      if (next.length > FEATURE_LINE_MAX) break;
      acc = next;
      if (inRange(acc)) return acc;
    }
    if (acc.length >= FEATURE_LINE_MIN && acc.length <= FEATURE_LINE_MAX) return acc;

    let cut = s.slice(0, FEATURE_LINE_MAX + 1).lastIndexOf(' ');
    if (cut < FEATURE_LINE_MIN) {
      cut = s.indexOf(' ', FEATURE_LINE_MIN);
      if (cut === -1 || cut > FEATURE_LINE_MAX) cut = s.slice(0, FEATURE_LINE_MAX).lastIndexOf(' ');
    }
    if (cut <= 0) return null;
    let t = s.slice(0, cut).trim().replace(/[,;:]$/, '');
    if (inRange(t)) return t;
    if (t.length > FEATURE_LINE_MAX) return fitFeatureLine(t);
    if (t.length >= FEATURE_LINE_MIN) return t;
  }

  return null;
}

function normalizeFeatures(raw: string): string {
  const candidates = splitFeatureCandidates(stripFeatureNoise(raw));
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const c of candidates) {
    const line = fitFeatureLine(c);
    if (!line) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(line);
    if (lines.length >= 12) break;
  }

  let fb = 0;
  while (lines.length < MIN_FEATURE_LINES && fb < FEATURE_FALLBACKS.length) {
    const f = FEATURE_FALLBACKS[fb]!;
    fb += 1;
    const key = f.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(f);
  }

  return lines.slice(0, 12).join('\n');
}

export const suggestDescription = async (req: Request, res: Response): Promise<Response> => {
  try {
    const settings = await getOrCreateAdminSettings();
    if (!settings.aiDescriptionSuggestionsEnabled) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'AI description suggestions are disabled in Admin settings.',
      });
    }

    if (!isGroqConfigured()) {
      return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        message: 'AI suggestion service is not configured (NEXTFIT_ADMIN_CONSOLE_API_KEY_GROQ)',
      });
    }

    if (!req.body || typeof req.body !== 'object') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Request body is required',
      });
    }

    const {
      context = 'Product',
      name,
      categoryName = '',
      mainImageUrl = '',
      optionalKeywords = '',
    } = req.body as Record<string, unknown>;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'name is required and must be a non-empty string',
      });
    }

    const catStr = typeof categoryName === 'string' ? categoryName : '';
    const imgStr = typeof mainImageUrl === 'string' ? mainImageUrl : '';
    const themes =
      typeof optionalKeywords === 'string' && optionalKeywords.trim() ? optionalKeywords.trim() : '';

    const prompt = [
      `Write the customer-facing description for one ${String(context).trim().toLowerCase()} listing.`,
      'Output: 2–4 fluent sentences only. Plain text. No titles, no labels, no bullet numbers, no URLs.',
      'Do not write the words "Product Name", "Category", "Image", "URL", "Themes", or "Sentences".',
      'Do not repeat field names or paste link addresses. Start directly with the product.',
      '',
      buildCompactListingBlock(name, catStr, {
        themes: themes || undefined,
        assumePhoto: Boolean(imgStr?.trim()),
      }),
      '',
      'Finish with proper punctuation. Be specific to the title and section.',
    ].join('\n');

    const groqOut = await groqCompleteText({
      systemPrompt: ADMIN_AI_SYSTEM_BASE,
      userMessage: prompt,
      maxTokens: GROQ_MAX_TOKENS_DESCRIPTION,
      temperature: 0.38,
    });

    if (!groqOut.ok) {
      return respondGroqFailure(res, groqOut);
    }

    const suggestion = normalizeDescription(groqOut.text);

    if (!suggestion) {
      return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        message: 'AI service returned no usable text',
      });
    }

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { suggestion },
    });
  } catch (err) {
    console.error('suggestDescription error:', err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get suggestion',
    });
  }
};

export const suggestTags = async (req: Request, res: Response): Promise<Response> => {
  try {
    const settings = await getOrCreateAdminSettings();
    if (!settings.aiTagSuggestionsEnabled) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'AI tag suggestions are disabled in Admin settings.',
      });
    }

    if (!isGroqConfigured()) {
      return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        message: 'AI suggestion service is not configured (NEXTFIT_ADMIN_CONSOLE_API_KEY_GROQ)',
      });
    }

    if (!req.body || typeof req.body !== 'object') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Request body is required',
      });
    }

    const { name = '', description = '', categoryName = '', mainImageUrl = '' } = req.body as Record<string, unknown>;
    const nameStr = typeof name === 'string' ? name.trim() : '';
    const descStr = typeof description === 'string' ? description.trim().slice(0, 500) : '';
    const catStr = typeof categoryName === 'string' ? categoryName.trim() : '';
    const imgStr = typeof mainImageUrl === 'string' ? mainImageUrl.trim() : '';

    if (!nameStr && !descStr && !catStr && !imgStr) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Provide at least name, description, category, or image URL for tag suggestions',
      });
    }

    const descSnippet = descStr ? descStr.slice(0, 220) : '';
    const prompt = [
      'Task: write 5 to 8 ecommerce search tags for the listing below.',
      'Output format: a single line of comma-separated tags only.',
      `Rules: each tag is 1 to ${MAX_TAG_WORDS} words, max ${MAX_TAG_CHARS} characters.`,
      'Tags are short keywords shoppers might search (material, style, occasion, color, audience).',
      'Do not output sentences, quotes, labels, URLs, or phrases like "product name", "category", "description", or "image".',
      'Do not repeat or copy the blurb; infer keywords only.',
      '',
      `Title: ${nameStr || 'item'}`,
      `Department: ${catStr || 'general'}`,
      descSnippet ? `Blurb (themes only; do not copy): ${descSnippet}` : '',
      '',
      'Example of valid output: Blue, Cotton, Casual, Mens, Office, Summer',
    ]
      .filter(Boolean)
      .join('\n');

    const groqOut = await groqCompleteText({
      systemPrompt: ADMIN_AI_SYSTEM_BASE,
      userMessage: prompt,
      maxTokens: GROQ_MAX_TOKENS_TAGS,
      temperature: 0.28,
    });

    if (!groqOut.ok) {
      return respondGroqFailure(res, groqOut);
    }

    const result = normalizeTags(groqOut.text, nameStr, catStr);

    if (!result) {
      return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        message: 'AI service returned no tags',
      });
    }

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { suggestion: result },
    });
  } catch (err) {
    console.error('suggestTags error:', err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get tag suggestion',
    });
  }
};

export const suggestFeatures = async (req: Request, res: Response): Promise<Response> => {
  try {
    const settings = await getOrCreateAdminSettings();
    if (!settings.aiDescriptionSuggestionsEnabled) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'AI feature suggestions use the same toggle as description suggestions in Admin settings.',
      });
    }

    if (!isGroqConfigured()) {
      return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        message: 'AI suggestion service is not configured (NEXTFIT_ADMIN_CONSOLE_API_KEY_GROQ)',
      });
    }

    if (!req.body || typeof req.body !== 'object') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Request body is required',
      });
    }

    const { name, categoryName = '', mainImageUrl = '', description = '' } = req.body as Record<string, unknown>;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'name is required',
      });
    }

    const catStr = typeof categoryName === 'string' ? categoryName : '';
    const imgStr = typeof mainImageUrl === 'string' ? mainImageUrl : '';
    const descStr = typeof description === 'string' ? description : '';
    const descSnippet = descStr.trim() ? descStr.trim().slice(0, 220) : '';

    const prompt = [
      `Write ${MIN_FEATURE_LINES} or more lines. Output ONLY the feature lines, one per line.`,
      `Each line: ${FEATURE_LINE_MIN}-${FEATURE_LINE_MAX} characters. One concrete benefit per line.`,
      'Do not output rules, labels, "Product name", "Category", or URLs. No numbering at line start.',
      '',
      buildCompactListingBlock(name, catStr, {
        notes: descSnippet || undefined,
        assumePhoto: Boolean(imgStr?.trim()),
      }),
    ].join('\n');

    const groqOut = await groqCompleteText({
      systemPrompt: ADMIN_AI_SYSTEM_BASE,
      userMessage: prompt,
      maxTokens: GROQ_MAX_TOKENS_FEATURES,
      temperature: 0.32,
    });

    if (!groqOut.ok) {
      return respondGroqFailure(res, groqOut);
    }

    const suggestion = normalizeFeatures(groqOut.text);

    if (!suggestion) {
      return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        message: 'AI returned no features',
      });
    }

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { suggestion },
    });
  } catch (err) {
    console.error('suggestFeatures error:', err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get feature suggestions',
    });
  }
};
