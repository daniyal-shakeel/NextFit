import Groq from 'groq-sdk';
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  AuthenticationError,
  PermissionDeniedError,
  RateLimitError,
} from 'groq-sdk';

export const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';
const TIMEOUT_MS = 90_000;

export type GroqFailureCode = 'GROQ_API_ERROR' | 'RATE_LIMIT' | 'PARSE_ERROR';

export type GroqJsonResult =
  | { ok: true; data: unknown }
  | { ok: false; code: GroqFailureCode; message: string };

export type GroqTextResult =
  | { ok: true; text: string }
  | { ok: false; code: GroqFailureCode; message: string };

function resolveModel(override?: string): string {
  const fromEnv = process.env.AI_MODEL_GROQ?.trim();
  return (override?.trim() || fromEnv || DEFAULT_GROQ_MODEL);
}

function stripMarkdownFences(raw: string): string {
  let t = raw.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  }
  return t;
}

async function groqChatCompletion(params: {
  messages: { role: 'system' | 'user'; content: string }[];
  max_tokens: number;
  temperature: number;
  model: string;
}): Promise<GroqTextResult> {
  const apiKey = process.env.NEXTFIT_ADMIN_CONSOLE_API_KEY_GROQ?.trim();
  if (!apiKey) {
    return {
      ok: false,
      code: 'GROQ_API_ERROR',
      message: 'AI service unavailable. Try again.',
    };
  }

  const client = new Groq({ apiKey, timeout: TIMEOUT_MS });

  try {
    const completion = await client.chat.completions.create({
      model: params.model,
      messages: params.messages,
      temperature: params.temperature,
      max_tokens: params.max_tokens,
    });
    const rawText = completion.choices[0]?.message?.content?.trim() ?? '';
    if (!rawText) {
      return {
        ok: false,
        code: 'PARSE_ERROR',
        message: 'AI could not understand the input. Please be more specific.',
      };
    }
    return { ok: true, text: rawText };
  } catch (err) {
    if (err instanceof RateLimitError) {
      return {
        ok: false,
        code: 'RATE_LIMIT',
        message: 'Too many requests. Wait a moment and try again.',
      };
    }
    if (err instanceof AuthenticationError || err instanceof PermissionDeniedError) {
      return {
        ok: false,
        code: 'GROQ_API_ERROR',
        message: 'AI service unavailable. Try again.',
      };
    }
    if (err instanceof APIConnectionTimeoutError) {
      return {
        ok: false,
        code: 'GROQ_API_ERROR',
        message: 'AI service unavailable. Try again.',
      };
    }
    if (err instanceof APIConnectionError) {
      return {
        ok: false,
        code: 'GROQ_API_ERROR',
        message: 'AI service unavailable. Try again.',
      };
    }
    console.error('groqChatCompletion unexpected error:', err);
    return {
      ok: false,
      code: 'GROQ_API_ERROR',
      message: 'AI service unavailable. Try again.',
    };
  }
}

export async function groqCompleteJson(params: {
  systemPrompt: string;
  userMessage: string;
}): Promise<GroqJsonResult> {
  const model = resolveModel();
  const chat = await groqChatCompletion({
    messages: [
      { role: 'system', content: params.systemPrompt },
      { role: 'user', content: params.userMessage },
    ],
    max_tokens: 8192,
    temperature: 0.15,
    model,
  });

  if (!chat.ok) {
    return chat;
  }

  const cleaned = stripMarkdownFences(chat.text);
  try {
    const data = JSON.parse(cleaned) as unknown;
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      code: 'PARSE_ERROR',
      message: 'AI could not understand the input. Please be more specific.',
    };
  }
}

export async function groqCompleteText(params: {
  systemPrompt?: string;
  userMessage: string;
  maxTokens: number;
  temperature: number;
  model?: string;
}): Promise<GroqTextResult> {
  const model = resolveModel(params.model);
  const messages: { role: 'system' | 'user'; content: string }[] = [];
  if (params.systemPrompt?.trim()) {
    messages.push({ role: 'system', content: params.systemPrompt.trim() });
  }
  messages.push({ role: 'user', content: params.userMessage });

  return groqChatCompletion({
    messages,
    max_tokens: params.maxTokens,
    temperature: params.temperature,
    model,
  });
}
