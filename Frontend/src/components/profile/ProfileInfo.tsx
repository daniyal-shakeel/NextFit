import { useState, useEffect } from 'react';
import { User, Camera, Pencil, Save, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { User as UserType } from '@/lib/types';
import { getAvatarUrl } from '@/lib/api';

const AVATAR_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const NAME_MAX = 100;
const PHONE_REST_MAX = 20;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Parse combined phone (e.g. +923001234567) into country code and rest. */
function parsePhone(combined: string | undefined): { code: string; rest: string } {
  if (!combined || !combined.trim()) return { code: '+92', rest: '' };
  const s = combined.trim();
  if (s.startsWith('+92') && s.length >= 13) return { code: '+92', rest: s.slice(3).replace(/\D/g, '') };
  if (s.startsWith('+') && s.length >= 10) {
    const digits = s.replace(/\D/g, '');
    if (digits.startsWith('92') && digits.length === 12) return { code: '+92', rest: digits.slice(2) };
    return { code: s.slice(0, 4), rest: s.slice(4).replace(/\D/g, '') };
  }
  return { code: '+92', rest: s.replace(/\D/g, '') };
}

interface ProfileInfoProps {
  user: UserType;
  onUpdate: (user: Partial<UserType>) => void | Promise<void>;
  onAvatarUpload?: (file: File) => void | Promise<void>;
}

export const ProfileInfo = ({ user, onUpdate, onAvatarUpload }: ProfileInfoProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const initialPhone = user.phoneNumber && user.phoneCountryCode
    ? { code: user.phoneCountryCode, rest: user.phoneNumber }
    : parsePhone(user.phone);
  const [formData, setFormData] = useState({
    name: user.name ?? '',
    email: user.email ?? '',
    phoneCountryCode: initialPhone.code,
    phoneNumber: initialPhone.rest,
  });
  const [avatarUploading, setAvatarUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const p = user.phoneNumber && user.phoneCountryCode
      ? { code: user.phoneCountryCode, rest: user.phoneNumber }
      : parsePhone(user.phone);
    setFormData({
      name: user.name ?? '',
      email: user.email ?? '',
      phoneCountryCode: p.code,
      phoneNumber: p.rest,
    });
  }, [user.name, user.email, user.phone, user.phoneCountryCode, user.phoneNumber]);

  const validateProfile = (): string | null => {
    const name = formData.name.trim();
    if (!name) return 'Full name is required.';
    if (name.length > NAME_MAX) return `Name cannot exceed ${NAME_MAX} characters.`;
    const email = formData.email.trim();
    if (email) {
      if (!EMAIL_REGEX.test(email)) return 'Please enter a valid email address.';
      if (email.length > 254) return 'Email is too long.';
    }
    const rest = formData.phoneNumber.replace(/\D/g, '');
    if (rest.length > PHONE_REST_MAX) return `Phone number cannot exceed ${PHONE_REST_MAX} digits.`;
    return null;
  };

  const handleSave = async () => {
    const err = validateProfile();
    if (err) {
      toast({
        title: 'Validation error',
        description: err,
        variant: 'destructive',
      });
      return;
    }
    try {
      await Promise.resolve(onUpdate({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phoneCountryCode: formData.phoneCountryCode.trim() || undefined,
        phoneNumber: formData.phoneNumber.replace(/\D/g, '').trim() || undefined,
      }));
      setIsEditing(false);
      toast({
        title: 'Profile Updated',
        description: 'Your profile information has been saved.',
      });
    } catch (err) {
      toast({
        title: 'Update failed',
        description: err instanceof Error ? err.message : 'Could not save profile.',
        variant: 'destructive',
      });
    }
  };

  const handleCancel = () => {
    const p = user.phoneNumber && user.phoneCountryCode
      ? { code: user.phoneCountryCode, rest: user.phoneNumber }
      : parsePhone(user.phone);
    setFormData({
      name: user.name ?? '',
      email: user.email ?? '',
      phoneCountryCode: p.code,
      phoneNumber: p.rest,
    });
    setIsEditing(false);
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please use JPEG, PNG, GIF, or WebP.',
        variant: 'destructive',
      });
      return;
    }
    if (file.size > AVATAR_MAX_SIZE) {
      toast({
        title: 'File too large',
        description: 'Avatar must be 10MB or smaller.',
        variant: 'destructive',
      });
      return;
    }
    if (!onAvatarUpload) {
      toast({
        title: 'Update failed',
        description: 'Avatar upload is not available.',
        variant: 'destructive',
      });
      return;
    }
    setAvatarUploading(true);
    try {
      await Promise.resolve(onAvatarUpload(file));
      toast({
        title: 'Avatar Updated',
        description: 'Your profile picture has been updated.',
      });
    } catch (err) {
      toast({
        title: 'Update failed',
        description: err instanceof Error ? err.message : 'Could not save avatar.',
        variant: 'destructive',
      });
    } finally {
      setAvatarUploading(false);
      e.target.value = '';
    }
  };

  const initials = user.name?.split(' ').map(n => n[0]).join('') || 'U';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Personal Information
        </CardTitle>
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
        {/* Avatar Section */}
        <div className="flex items-center gap-6">
          <div className="relative">
            <Avatar className="h-24 w-24">
              <AvatarImage src={getAvatarUrl(user.avatar) ?? user.avatar} alt={user.name} />
              <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <label 
              htmlFor="avatar-upload" 
              className={`absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full cursor-pointer hover:bg-primary/90 transition-colors ${avatarUploading ? 'pointer-events-none opacity-70' : ''}`}
            >
              <Camera className="h-4 w-4" />
              <input
                id="avatar-upload"
                type="file"
                accept={ALLOWED_IMAGE_TYPES.join(',')}
                className="hidden"
                onChange={handleAvatarFileChange}
                disabled={avatarUploading}
              />
            </label>
          </div>
          <div>
            <h3 className="font-semibold text-lg">{user.name}</h3>
            <p className="text-muted-foreground">{user.email || 'Not set'}</p>
          </div>
        </div>

        {/* Form Fields */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            {isEditing ? (
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            ) : (
              <p className="p-2 bg-muted rounded-md">{user.name}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            {isEditing ? (
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Add email (optional)"
              />
            ) : (
              <p className="p-2 bg-muted rounded-md">{user.email || 'Not set'}</p>
            )}
          </div>
          <div className="space-y-2 md:grid-cols-2 md:grid md:col-span-2 md:gap-4">
            <div className="space-y-2">
              <Label htmlFor="phoneCountryCode">Country code</Label>
              {isEditing ? (
                <Input
                  id="phoneCountryCode"
                  type="text"
                  value={formData.phoneCountryCode}
                  onChange={(e) => setFormData({ ...formData, phoneCountryCode: e.target.value })}
                  placeholder="+92"
                />
              ) : (
                <p className="p-2 bg-muted rounded-md">{user.phoneCountryCode || user.phone ? (user.phoneCountryCode || parsePhone(user.phone).code) : 'Not set'}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone number</Label>
              {isEditing ? (
                <Input
                  id="phoneNumber"
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value.replace(/\D/g, '') })}
                  placeholder="3001234567"
                />
              ) : (
                <p className="p-2 bg-muted rounded-md">{user.phoneNumber || user.phone ? (user.phoneNumber || parsePhone(user.phone).rest) || 'Not set' : 'Not set'}</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
