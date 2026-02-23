import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Package, Bell, Palette, MapPin, LogOut } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfileInfo } from '@/components/profile/ProfileInfo';
import { MeasurementsForm } from '@/components/profile/MeasurementsForm';
import { AddressBook } from '@/components/profile/AddressBook';
import { SavedDesigns } from '@/components/profile/SavedDesigns';
import { useFeatureConfig } from '@/lib/featureConfig';
import { ordersAPI, customersAPI, type OrderResponse } from '@/lib/api';
import { useStore } from '@/store/useStore';
import type { UserMeasurements } from '@/lib/types';

function mapApiMeasurements(m: {
  chest?: number;
  waist?: number;
  hips?: number;
  height?: number;
  weight?: number;
  shirtSize?: string;
  pantsSize?: string;
}): UserMeasurements {
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

const Account = () => {
  const { 
    user, 
    notifications, 
    isAuthenticated, 
    updateUser, 
    updateMeasurements,
    addresses,
    fetchAddresses,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
    savedDesigns,
    deleteDesign,
    addToCart,
    logout,
  } = useStore();
  
  const unreadCount = notifications.filter(n => !n.read).length;
  const { comingSoonEnabled } = useFeatureConfig();
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
      measurements: d.measurements,
    });
    if (d.measurements) updateMeasurements(mapApiMeasurements(d.measurements));
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
      measurements: d.measurements,
    });
    if (d.measurements) updateMeasurements(mapApiMeasurements(d.measurements));
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
      updateUser({ measurements: mapApiMeasurements(d.measurements) });
      updateMeasurements(mapApiMeasurements(d.measurements));
    }
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Please Sign In</h1>
        <p className="text-muted-foreground mb-6">Sign in to access your account</p>
        <Link to="/auth"><Button>Sign In</Button></Link>
      </div>
    );
  }

  const handleAddDesignToCart = (design: any) => {
    addToCart({
      product: {
        id: `custom-${design.id}`,
        name: 'Custom Shirt Design',
        description: 'Your personalized shirt design',
        price: 0, // Price TBD via email
        category: 'shirts',
        image: '/placeholder.svg',
        inStock: true,
        rating: 0,
        reviews: 0,
      },
      quantity: 1,
      customization: design,
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{user.name}</h1>
              <p className="text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <Button variant="outline" onClick={logout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid grid-cols-5 w-full max-w-2xl">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Orders</span>
            </TabsTrigger>
            <TabsTrigger value="designs" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Designs</span>
              {comingSoonEnabled && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal hidden sm:inline-flex">
                  Coming Soon
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="addresses" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Addresses</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notifications</span>
              {unreadCount > 0 && <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center">{unreadCount}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <ProfileInfo user={user} onUpdate={handleProfileUpdate} onAvatarUpload={handleAvatarUpload} />
            <MeasurementsForm
              measurements={user.measurements}
              onUpdate={handleMeasurementsUpdate}
            />
          </TabsContent>

          {/* Orders Tab */}
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
                          <p className="font-medium font-mono text-sm">{order._id}</p>
                          <p className="text-sm text-muted-foreground">
                            {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '—'} • {order.lineItems?.length ?? 0} item(s)
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>
                            {order.status}
                          </Badge>
                          <span className="font-medium">${order.total?.toFixed(2) ?? '0.00'}</span>
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

          {/* Saved Designs Tab */}
          <TabsContent value="designs">
            <SavedDesigns 
              designs={savedDesigns} 
              onDelete={deleteDesign}
              onAddToCart={handleAddDesignToCart}
            />
          </TabsContent>

          {/* Addresses Tab */}
          <TabsContent value="addresses">
            <AddressBook
              addresses={addresses}
              onAdd={addAddress}
              onUpdate={(id, data) => updateAddress(id, data)}
              onDelete={deleteAddress}
              onSetDefault={setDefaultAddress}
            />
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-2">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notifications
                </h3>
                {notifications.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No notifications</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notifications.map(n => (
                      <div 
                        key={n.id} 
                        className={`p-4 border rounded-lg ${n.read ? 'opacity-60' : 'border-primary/30 bg-primary/5'}`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{n.title}</p>
                            <p className="text-sm text-muted-foreground">{n.message}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {n.type}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Account;
