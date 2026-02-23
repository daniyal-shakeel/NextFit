import { useState, useEffect } from 'react';
import { Ruler, Pencil, Save, X, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { UserMeasurements } from '@/lib/types';

interface MeasurementsFormProps {
  measurements?: UserMeasurements;
  onUpdate: (measurements: UserMeasurements) => void | Promise<void>;
}

const shirtSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const pantsSizes = ['26', '28', '30', '32', '34', '36', '38', '40', '42'];

const MEASUREMENT_LIMITS = {
  chest: { min: 0, max: 100 },
  waist: { min: 0, max: 100 },
  hips: { min: 0, max: 100 },
  height: { min: 0, max: 300 },
  weight: { min: 0, max: 500 },
} as const;

function validateMeasurements(m: UserMeasurements): string | null {
  const num = (val: number, key: keyof typeof MEASUREMENT_LIMITS): boolean => {
    const lim = MEASUREMENT_LIMITS[key];
    return !Number.isNaN(val) && val >= lim.min && val <= lim.max;
  };
  if (m.chest !== undefined && m.chest !== 0 && !num(m.chest, 'chest')) return `Chest must be between ${MEASUREMENT_LIMITS.chest.min} and ${MEASUREMENT_LIMITS.chest.max} inches.`;
  if (m.waist !== undefined && m.waist !== 0 && !num(m.waist, 'waist')) return `Waist must be between ${MEASUREMENT_LIMITS.waist.min} and ${MEASUREMENT_LIMITS.waist.max} inches.`;
  if (m.hips !== undefined && m.hips !== 0 && !num(m.hips, 'hips')) return `Hips must be between ${MEASUREMENT_LIMITS.hips.min} and ${MEASUREMENT_LIMITS.hips.max} inches.`;
  if (m.height !== undefined && m.height !== 0 && !num(m.height, 'height')) return `Height must be between ${MEASUREMENT_LIMITS.height.min} and ${MEASUREMENT_LIMITS.height.max} cm.`;
  if (m.weight !== undefined && m.weight !== 0 && !num(m.weight, 'weight')) return `Weight must be between ${MEASUREMENT_LIMITS.weight.min} and ${MEASUREMENT_LIMITS.weight.max} kg.`;
  if (typeof m.shirtSize === 'string' && m.shirtSize.length > 20) return 'Preferred shirt size is too long.';
  if (typeof m.pantsSize === 'string' && m.pantsSize.length > 20) return 'Preferred pants size is too long.';
  return null;
}

export const MeasurementsForm = ({ measurements, onUpdate }: MeasurementsFormProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<UserMeasurements>(
    measurements || {
      chest: 0,
      waist: 0,
      hips: 0,
      height: 0,
      weight: 0,
      shirtSize: '',
      pantsSize: '',
    }
  );
  const { toast } = useToast();

  useEffect(() => {
    setFormData(
      measurements || {
        chest: 0,
        waist: 0,
        hips: 0,
        height: 0,
        weight: 0,
        shirtSize: '',
        pantsSize: '',
      }
    );
  }, [measurements]);

  const handleSave = async () => {
    const err = validateMeasurements(formData);
    if (err) {
      toast({
        title: 'Validation error',
        description: err,
        variant: 'destructive',
      });
      return;
    }
    try {
      await Promise.resolve(onUpdate(formData));
      setIsEditing(false);
      toast({
        title: 'Measurements Saved',
        description: 'Your body measurements have been updated.',
      });
    } catch (err) {
      toast({
        title: 'Update failed',
        description: err instanceof Error ? err.message : 'Could not save measurements.',
        variant: 'destructive',
      });
    }
  };

  const handleCancel = () => {
    setFormData(
      measurements || {
        chest: 0,
        waist: 0,
        hips: 0,
        height: 0,
        weight: 0,
        shirtSize: '',
        pantsSize: '',
      }
    );
    setIsEditing(false);
  };

  const calculateSizeRecommendation = () => {
    if (formData.chest && formData.waist) {
      if (formData.chest < 36) return 'S';
      if (formData.chest < 40) return 'M';
      if (formData.chest < 44) return 'L';
      if (formData.chest < 48) return 'XL';
      return 'XXL';
    }
    return null;
  };

  const recommendation = calculateSizeRecommendation();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Ruler className="h-5 w-5" />
            Body Measurements
          </CardTitle>
          <CardDescription>
            Add your measurements for personalized size recommendations
          </CardDescription>
        </div>
        {!isEditing ? (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Size Recommendation */}
        {recommendation && (
          <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
            <p className="text-sm font-medium text-primary">
              Based on your measurements, we recommend size <span className="font-bold">{recommendation}</span> for shirts.
            </p>
          </div>
        )}

        {/* Body Measurements */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="chest" className="flex items-center gap-1">
              Chest (inches)
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Measure around the fullest part of your chest</p>
                </TooltipContent>
              </Tooltip>
            </Label>
            {isEditing ? (
              <Input
                id="chest"
                type="number"
                value={formData.chest || ''}
                onChange={(e) => setFormData({ ...formData, chest: Number(e.target.value) })}
                placeholder="40"
              />
            ) : (
              <p className="p-2 bg-muted rounded-md">{formData.chest || 'Not set'}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="waist" className="flex items-center gap-1">
              Waist (inches)
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Measure around your natural waistline</p>
                </TooltipContent>
              </Tooltip>
            </Label>
            {isEditing ? (
              <Input
                id="waist"
                type="number"
                value={formData.waist || ''}
                onChange={(e) => setFormData({ ...formData, waist: Number(e.target.value) })}
                placeholder="32"
              />
            ) : (
              <p className="p-2 bg-muted rounded-md">{formData.waist || 'Not set'}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="hips" className="flex items-center gap-1">
              Hips (inches)
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Measure around the fullest part of your hips</p>
                </TooltipContent>
              </Tooltip>
            </Label>
            {isEditing ? (
              <Input
                id="hips"
                type="number"
                value={formData.hips || ''}
                onChange={(e) => setFormData({ ...formData, hips: Number(e.target.value) })}
                placeholder="38"
              />
            ) : (
              <p className="p-2 bg-muted rounded-md">{formData.hips || 'Not set'}</p>
            )}
          </div>
        </div>

        {/* Height and Weight */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="height">Height (cm)</Label>
            {isEditing ? (
              <Input
                id="height"
                type="number"
                value={formData.height || ''}
                onChange={(e) => setFormData({ ...formData, height: Number(e.target.value) })}
                placeholder="180"
              />
            ) : (
              <p className="p-2 bg-muted rounded-md">{formData.height ? `${formData.height} cm` : 'Not set'}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="weight">Weight (kg)</Label>
            {isEditing ? (
              <Input
                id="weight"
                type="number"
                value={formData.weight || ''}
                onChange={(e) => setFormData({ ...formData, weight: Number(e.target.value) })}
                placeholder="75"
              />
            ) : (
              <p className="p-2 bg-muted rounded-md">{formData.weight ? `${formData.weight} kg` : 'Not set'}</p>
            )}
          </div>
        </div>

        {/* Preferred Sizes */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="shirtSize">Preferred Shirt Size</Label>
            {isEditing ? (
              <Select
                value={formData.shirtSize || ''}
                onValueChange={(value) => setFormData({ ...formData, shirtSize: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  {shirtSizes.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="p-2 bg-muted rounded-md">{formData.shirtSize || 'Not set'}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="pantsSize">Preferred Pants Size</Label>
            {isEditing ? (
              <Select
                value={formData.pantsSize || ''}
                onValueChange={(value) => setFormData({ ...formData, pantsSize: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  {pantsSizes.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="p-2 bg-muted rounded-md">{formData.pantsSize || 'Not set'}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
