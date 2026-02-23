import { useState } from 'react';
import { MapPin, Plus, Pencil, Trash2, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Address } from '@/lib/types';

interface SavedAddress extends Address {
  id: string;
  label: string;
  isDefault: boolean;
}

interface AddressBookProps {
  addresses: SavedAddress[];
  onAdd: (address: Omit<SavedAddress, 'id'>) => void | Promise<void>;
  onUpdate: (id: string, address: Partial<Omit<SavedAddress, 'id'>>) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onSetDefault: (id: string) => void | Promise<void>;
}

const emptyAddress: Omit<SavedAddress, 'id'> = {
  label: '',
  street: '',
  city: '',
  state: '',
  zipCode: '',
  country: '',
  isDefault: false,
};

export const AddressBook = ({ addresses, onAdd, onUpdate, onDelete, onSetDefault }: AddressBookProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);
  const [formData, setFormData] = useState<Omit<SavedAddress, 'id'>>(emptyAddress);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleOpenAdd = () => {
    setEditingAddress(null);
    setFormData(emptyAddress);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (address: SavedAddress) => {
    setEditingAddress(address);
    setFormData(address);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.label || !formData.street || !formData.city) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      if (editingAddress) {
        await Promise.resolve(onUpdate(editingAddress.id, formData));
        toast({ title: 'Address Updated', description: 'Your address has been updated.' });
      } else {
        await Promise.resolve(onAdd(formData));
        toast({ title: 'Address Added', description: 'New address has been saved.' });
      }
      setIsDialogOpen(false);
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save address. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await Promise.resolve(onDelete(id));
      toast({ title: 'Address Deleted', description: 'Address has been removed.' });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete address.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Saved Addresses
          </CardTitle>
          <CardDescription>Manage your shipping and billing addresses</CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={handleOpenAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Add Address
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingAddress ? 'Edit Address' : 'Add New Address'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="label">Label *</Label>
                <Input
                  id="label"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder="Home, Office, etc."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="street">Street Address *</Label>
                <Input
                  id="street"
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  placeholder="123 Main St"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="New York"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="NY"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="zipCode">ZIP Code</Label>
                  <Input
                    id="zipCode"
                    value={formData.zipCode}
                    onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                    placeholder="10001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    placeholder="USA"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Address'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {addresses.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No saved addresses yet</p>
            <p className="text-sm">Add an address for faster checkout</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {addresses.map((address) => (
              <div
                key={address.id}
                className={`p-4 border rounded-lg relative ${address.isDefault ? 'border-primary bg-primary/5' : ''}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{address.label}</span>
                    {address.isDefault && (
                      <Badge variant="secondary" className="text-xs">Default</Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEdit(address)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(address.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{address.street}</p>
                <p className="text-sm text-muted-foreground">
                  {address.city}, {address.state} {address.zipCode}
                </p>
                <p className="text-sm text-muted-foreground">{address.country}</p>
                {!address.isDefault && (
                  <Button
                    variant="link"
                    size="sm"
                    className="px-0 mt-2"
                    onClick={() => onSetDefault(address.id)}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Set as default
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
