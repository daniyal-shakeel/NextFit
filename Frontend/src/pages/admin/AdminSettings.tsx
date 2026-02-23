import { useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
const currencies = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨' },
];

const defaultSettings = {
  virtualTryOnEnabled: true,
  currency: 'PKR',
  taxRate: 8.5,
  shippingFee: 9.99,
  freeShippingThreshold: 100,
};

const AdminSettings = () => {
  const [settings, setSettings] = useState(defaultSettings);

  const handleSave = () => {
    toast.success('Settings saved successfully');
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-sm md:text-base text-muted-foreground">Manage store settings and preferences</p>
        </div>
        <Button onClick={handleSave} className="w-full sm:w-auto">
          <Save className="h-4 w-4 mr-2" /> Save Changes
        </Button>
      </div>

      <div className="grid gap-4 md:gap-6">
        {/* Virtual Try-On Settings */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base md:text-lg">Virtual Try-On</CardTitle>
            <CardDescription className="text-xs md:text-sm">Configure virtual try-on feature availability</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5 flex-1">
                <Label className="text-sm md:text-base">Enable Virtual Try-On</Label>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Allow users to use virtual try-on features
                </p>
              </div>
              <Switch 
                checked={settings.virtualTryOnEnabled}
                onCheckedChange={(checked) => setSettings({ ...settings, virtualTryOnEnabled: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Currency Settings */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base md:text-lg">Currency & Pricing</CardTitle>
            <CardDescription className="text-xs md:text-sm">Configure currency and pricing options</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 md:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Currency</Label>
                <Select 
                  value={settings.currency}
                  onValueChange={(value) => setSettings({ ...settings, currency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((currency) => (
                      <SelectItem key={currency.code} value={currency.code}>
                        {currency.symbol} {currency.name} ({currency.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Tax Rate (%)</Label>
                <Input 
                  type="number" 
                  value={settings.taxRate}
                  onChange={(e) => setSettings({ ...settings, taxRate: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Shipping Fee</Label>
                <Input 
                  type="number" 
                  value={settings.shippingFee}
                  onChange={(e) => setSettings({ ...settings, shippingFee: parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Free Shipping Threshold</Label>
                <Input 
                  type="number" 
                  value={settings.freeShippingThreshold}
                  onChange={(e) => setSettings({ ...settings, freeShippingThreshold: parseFloat(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">
                  Free shipping for orders above this amount
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp Integration */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base md:text-lg">WhatsApp Integration</CardTitle>
            <CardDescription className="text-xs md:text-sm">Configure WhatsApp order confirmation settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5 flex-1">
                <Label className="text-sm md:text-base">Enable WhatsApp Confirmation</Label>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Send order confirmation messages via WhatsApp
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">WhatsApp Business Number</Label>
              <Input placeholder="+1234567890" defaultValue="+1234567890" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Confirmation Message Template</Label>
              <Input 
                placeholder="Message template" 
                defaultValue="Hi {name}! Please confirm your order #{orderId} for ${total}. Reply YES to confirm."
              />
              <p className="text-xs text-muted-foreground">
                Available variables: {'{name}'}, {'{orderId}'}, {'{total}'}, {'{items}'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base md:text-lg">Notification Settings</CardTitle>
            <CardDescription className="text-xs md:text-sm">Configure admin notification preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5 flex-1">
                <Label className="text-sm md:text-base">New Order Notifications</Label>
                <p className="text-xs md:text-sm text-muted-foreground">Get notified when new orders are placed</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5 flex-1">
                <Label className="text-sm md:text-base">Low Stock Alerts</Label>
                <p className="text-xs md:text-sm text-muted-foreground">Get notified when products are low in stock</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5 flex-1">
                <Label className="text-sm md:text-base">New User Registrations</Label>
                <p className="text-xs md:text-sm text-muted-foreground">Get notified when new users register</p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminSettings;