import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { User, Package, MapPin, LogOut } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfileInfo } from '@/components/profile/ProfileInfo';
import { MeasurementsForm } from '@/components/profile/MeasurementsForm';
import { AddressBook } from '@/components/profile/AddressBook';
import { ordersAPI, customersAPI, type OrderResponse } from '@/lib/api';
import { useStore } from '@/store/useStore';
import { CURRENCY } from '@/lib/constants';
import type { UserMeasurements } from '@/lib/types';
import { mapApiMeasurements } from '@/lib/mapApiMeasurements';

const ACCOUNT_TABS = ['profile', 'orders', 'addresses'] as const;
type AccountTab = (typeof ACCOUNT_TABS)[number];

const Account = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: AccountTab = ACCOUNT_TABS.includes(tabParam as AccountTab)
    ? (tabParam as AccountTab)
    : 'profile';

  const { 
    user, 
    isAuthenticated, 
    updateUser, 
    updateMeasurements,
    addresses,
    fetchAddresses,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
    logout,
  } = useStore();
  
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    setOrdersLoading(true);
    setOrdersError(null);
    ordersAPI
      .listMine({ page: 1, limit: 20 })
      .then((res) => setOrders(res.data.items ?? []))
      .catch((err) => setOrdersError(err instanceof Error ? err.message : 'Failed to load orders'))
      .finally(() => setOrdersLoading(false));
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) fetchAddresses();
  }, [isAuthenticated, fetchAddresses]);

  const handleProfileUpdate = async (updates: Partial<{ name: string; email: string; phoneCountryCode?: string; phoneNumber?: string; avatar?: string }>) => {
    const res = await customersAPI.updateMe({
      name: updates.name,
      email: updates.email,
      avatar: updates.avatar,
      phoneCountryCode: updates.phoneCountryCode,
      phone: updates.phoneNumber,
    });
    const d = res.data;
    updateUser({
      name: d.name,
      email: d.email,
      phone: d.phone,
      phoneCountryCode: d.phoneCountryCode,
      phoneNumber: d.phoneNumber,
      avatar: d.avatar,
      measurements: mapApiMeasurements(d.measurements),
    });
    if (d.measurements) updateMeasurements(mapApiMeasurements(d.measurements)!);
  };

  const handleAvatarUpload = async (file: File) => {
    const res = await customersAPI.uploadAvatar(file);
    const d = res.data;
    updateUser({
      name: d.name,
      email: d.email,
      phone: d.phone,
      phoneCountryCode: d.phoneCountryCode,
      phoneNumber: d.phoneNumber,
      avatar: d.avatar,
      measurements: mapApiMeasurements(d.measurements),
    });
    if (d.measurements) updateMeasurements(mapApiMeasurements(d.measurements)!);
  };

  const handleMeasurementsUpdate = async (measurements: UserMeasurements) => {
    const res = await customersAPI.updateMe({
      measurements: {
        chest: measurements.chest,
        waist: measurements.waist,
        hips: measurements.hips,
        height: measurements.height,
        weight: measurements.weight,
        shirtSize: measurements.shirtSize,
        pantsSize: measurements.pantsSize,
      },
    });
    const d = res.data;
    if (d.measurements) {
      const m = mapApiMeasurements(d.measurements)!;
      updateUser({ measurements: m });
      updateMeasurements(m);
    }
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4 text-foreground">Please Sign In</h1>
        <p className="text-muted-foreground mb-6">Sign in to access your account</p>
        <Link to="/auth"><Button>Sign In</Button></Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{user.name}</h1>
              <p className="text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <Button variant="outline" onClick={logout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            if (ACCOUNT_TABS.includes(v as AccountTab)) setSearchParams({ tab: v });
          }}
          className="space-y-6"
        >
          <TabsList className="grid grid-cols-3 w-full max-w-2xl">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Orders</span>
            </TabsTrigger>
            <TabsTrigger value="addresses" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Addresses</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <ProfileInfo user={user} onUpdate={handleProfileUpdate} onAvatarUpload={handleAvatarUpload} />
            <MeasurementsForm
              measurements={user.measurements}
              onUpdate={handleMeasurementsUpdate}
            />
          </TabsContent>

          <TabsContent value="orders" className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Your Orders
                </h3>
                {ordersLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading orders…</div>
                ) : ordersError ? (
                  <div className="text-center py-8 text-destructive">{ordersError}</div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No orders yet</p>
                    <Link to="/shop">
                      <Button className="mt-4">Start Shopping</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <div key={order._id} className="flex justify-between items-center p-4 border rounded-lg">
                        <div>
                          <p className="font-medium font-mono text-sm">{order.orderNumber ?? order._id}</p>
                          <p className="text-sm text-muted-foreground">
                            {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '—'} • {order.lineItems?.length ?? 0} item(s)
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>
                            {order.status}
                          </Badge>
                          <span className="font-medium">{CURRENCY} {order.total?.toFixed(2) ?? '0.00'}</span>
                          <Link to={`/order/${order._id}`}>
                            <Button size="sm" variant="outline">Track</Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="addresses">
            <AddressBook
              addresses={addresses}
              onAdd={addAddress}
              onUpdate={(id, data) => updateAddress(id, data)}
              onDelete={deleteAddress}
              onSetDefault={setDefaultAddress}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Account;
