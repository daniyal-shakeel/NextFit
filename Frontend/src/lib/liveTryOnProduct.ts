import type { Product } from '@/lib/types';
import { DEFAULT_DEV_GARMENT_IMAGE, isDevGarmentProduct } from '@/lib/devShirts';

const POSITIVE_HINTS = [
  'transparent',
  'removebg',
  'mockup',
  'flat',
  'front',
  'garment',
  'shirt',
  't-shirt',
  'tshirt',
  'tee',
  'apparel',
  'product',
  'tryon',
] as const;

const NEGATIVE_HINTS = [
  'model',
  'person',
  'lifestyle',
  'banner',
  'hero',
  'avatar',
  'profile',
  'room',
  'background',
] as const;

function scoreImageUrl(url: string, productName: string): number {
  const lower = `${url} ${productName}`.toLowerCase();
  let score = 0;

  if (/\.png($|\?)/.test(lower)) score += 8;
  if (/\.webp($|\?)/.test(lower)) score += 5;
  if (/\.jpe?g($|\?)/.test(lower)) score -= 2;

  for (const hint of POSITIVE_HINTS) {
    if (lower.includes(hint)) score += 4;
  }
  for (const hint of NEGATIVE_HINTS) {
    if (lower.includes(hint)) score -= 6;
  }

  return score;
}

export function getLiveTryOnGarmentImage(product: Product | null | undefined): string {
  if (!product) return DEFAULT_DEV_GARMENT_IMAGE;
  if (isDevGarmentProduct(product)) return product.image || DEFAULT_DEV_GARMENT_IMAGE;

  const candidates = [product.image, ...(product.images ?? [])]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim())
    .filter((value, index, list) => list.indexOf(value) === index);

  if (candidates.length === 0) return DEFAULT_DEV_GARMENT_IMAGE;

  return [...candidates]
    .sort((a, b) => scoreImageUrl(b, product.name) - scoreImageUrl(a, product.name))[0];
}
