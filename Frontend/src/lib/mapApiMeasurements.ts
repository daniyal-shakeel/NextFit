import type { UserMeasurements } from './types';

type ApiMeasurements = {
  chest?: number;
  waist?: number;
  hips?: number;
  height?: number;
  weight?: number;
  shirtSize?: string;
  pantsSize?: string;
};

export function mapApiMeasurements(m?: ApiMeasurements | null): UserMeasurements | undefined {
  if (!m) return undefined;
  return {
    chest: m.chest ?? 0,
    waist: m.waist ?? 0,
    hips: m.hips ?? 0,
    height: m.height ?? 0,
    weight: m.weight ?? 0,
    shirtSize: m.shirtSize,
    pantsSize: m.pantsSize,
  };
}
