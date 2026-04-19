import type { Product } from '@/lib/types';

const FEATURED_TRYON = [
  {
    file: 'Plain white T-shirt on transparent background.png',
    id: 'tryon-plain-white-longsleeve',
    name: 'Plain white long-sleeve tee',
  },
  {
    file: 'White T-shirt with Github logo.png',
    id: 'tryon-github-longsleeve',
    name: 'White long-sleeve (GitHub)',
  },
] as const;

const DEV_ASSET_FILES = [
  'dev-shirt.png',
  'dev-shirt1.png',
  '4_8dd64585-7db1-4648-8bdd-f0653056fbc6_600x.png',
  '5_11c176a8-4861-49e6-8167-ab4ffe211844_600x.png',
  '6_61ce35ee-f960-4a62-90b0-3f195d9059dc_1200x.png',
  'images.png',
] as const;

function displayName(filename: string): string {
  if (filename === 'dev-shirt.png') return 'Dev shirt';
  if (filename === 'dev-shirt1.png') return 'Dev shirt 1';
  if (filename === 'images.png') return 'Dev: images';
  const m = filename.match(/^(\d)_/);
  if (m) return `Garment ${m[1]} (sample)`;
  return filename.replace(/\.[^.]+$/, '');
}

function devIdForFile(filename: string, index: number): string {
  if (filename === 'dev-shirt.png') return 'dev-shirt';
  return `dev-${index}`;
}

const baseFields = {
  description: 'Local asset for development try-on',
  price: 0,
  category: 'shirts',
  inStock: true,
  rating: 0,
  reviews: 0,
} as const;

function assetUrl(file: string): string {
  return `/assets/${encodeURIComponent(file)}`;
}

export function getFeaturedTryOnGarments(): Product[] {
  return FEATURED_TRYON.map((entry) => ({
    ...baseFields,
    id: entry.id,
    name: entry.name,
    image: assetUrl(entry.file),
  }));
}

export function getDevGarmentProducts(): Product[] {
  return DEV_ASSET_FILES.map((file, index) => ({
    ...baseFields,
    id: devIdForFile(file, index),
    name: displayName(file),
    image: assetUrl(file),
  }));
}

export const DEFAULT_DEV_GARMENT_IMAGE = '/assets/dev-shirt.png' as const;

export function isDevGarmentProduct(product: Product | null | undefined): boolean {
  if (!product) return false;
  return (
    product.id === 'dev-shirt' ||
    /^dev-\d+$/.test(product.id) ||
    product.id.startsWith('tryon-')
  );
}
