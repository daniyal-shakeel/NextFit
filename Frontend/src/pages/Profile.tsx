import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  User, 
  Package, 
  Bell, 
  Palette, 
  MapPin, 
  LogOut, 
  Settings,
  ChevronRight,
  ShoppingBag,
  Heart
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ProfileInfo } from '@/components/profile/ProfileInfo';
import { MeasurementsForm } from '@/components/profile/MeasurementsForm';
import { AddressBook } from '@/components/profile/AddressBook';
import { SavedDesigns } from '@/components/profile/SavedDesigns';
import { ordersAPI, addressesAPI, getAvatarUrl, type OrderResponse } from '@/lib/api';
import { useStore } from '@/store/useStore';
import { CURRENCY } from '@/lib/constants';

const Profile = () => {
  const { 
    user, 
    notifications, 
    isAuthenticated, 
    updateUser, 
    updateMeasurements,
    savedDesigns,
    deleteDesign,
    addToCart,
    logout,
  } = useStore();
  
  const unreadCount = notifications.filter(n => !n.read).length;
  const initials = user?.name?.split(' ').map(n => n[0]).join('') || 'U';
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [addressCount, setAddressCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    ordersAPI
      .listMine({ page: 1, limit: 20 })
      .then((res) => setOrders(res.data.items ?? []))
      .catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    addressesAPI
      .listMine()
      .then((res) => setAddressCount(res.data.items?.length ?? 0))
      .catch(() => setAddressCount(0));
  }, [isAuthenticated]);

  if (!isAuthenticated || !user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-md mx-auto">
          <div className="h-20 w-20 rounded-full bg-muted mx-auto mb-6 flex items-center justify-center">
            <User className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Welcome Back</h1>
          <p className="text-muted-foreground mb-6">Sign in to access your profile, orders, and saved designs</p>
          <div className="flex flex-col gap-3">
            <Link to="/auth"><Button className="w-full">Sign In</Button></Link>
            <Link to="/auth"><Button variant="outline" className="w-full">Create Account</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  const handleAddDesignToCart = (design: any) => {
    addToCart({
      product: {
        id: `custom-${design.id}`,
        name: 'Custom Shirt Design',
        description: 'Your personalized shirt design',
        price: 0,
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

  const quickLinks = [
    { icon: Package, label: 'My Orders', count: orders.length, href: '/account?tab=orders' },
    { icon: Palette, label: 'Saved Designs', count: savedDesigns.length, href: '/account?tab=designs' },
    { icon: MapPin, label: 'Addresses', count: addressCount, href: '/account?tab=addresses' },
    { icon: Bell, label: 'Notifications', count: unreadCount, href: '/account?tab=notifications' },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Profile Header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <Avatar className="h-24 w-24">
                <AvatarImage src={getAvatarUrl(user.avatar) ?? user.avatar} alt={user.name} />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-2xl font-bold">{user.name}</h1>
                <p className="text-muted-foreground">{user.email}</p>
                {user.phone && <p className="text-sm text-muted-foreground">{user.phone}</p>}
              </div>
              <div className="flex gap-2">
                <Link to="/account">
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                </Link>
                <Button variant="outline" size="sm" onClick={logout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickLinks.map((link) => (
            <Link key={link.label} to={link.href}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardContent className="p-4 flex flex-col items-center text-center">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <link.icon className="h-6 w-6 text-primary" />
                  </div>
                  <p className="font-medium">{link.label}</p>
                  {link.count > 0 && (
                    <Badge variant="secondary" className="mt-2">{link.count}</Badge>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Recent Orders */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Package className="h-5 w-5" />
                Recent Orders
              </h2>
              <Link to="/account?tab=orders">
                <Button variant="ghost" size="sm">
                  View All <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
            {orders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No orders yet</p>
                <Link to="/shop">
                  <Button className="mt-4">Start Shopping</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.slice(0, 3).map((order) => (
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
                      <span className="font-medium">{CURRENCY} {order.total}</span>
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

        {/* Saved Designs Preview */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Your Custom Designs
              </h2>
              <Link to="/account?tab=designs">
                <Button variant="ghost" size="sm">
                  View All <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
            {savedDesigns.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Palette className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No saved designs yet</p>
                <Link to="/customize">
                  <Button className="mt-4">Create Your Design</Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {savedDesigns.slice(0, 4).map(design => (
                  <div key={design.id} className="border rounded-lg p-3 hover:border-primary/50 transition-colors">
                    <div className="aspect-square bg-muted rounded-md mb-2 flex items-center justify-center">
                      <Palette className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium truncate">{design.name || 'Untitled Design'}</p>
                    <p className="text-xs text-muted-foreground">
                      {design.createdAt ? new Date(design.createdAt).toLocaleDateString() : 'Recently created'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Measurements Summary */}
        {user.measurements && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Your Measurements</h2>
                <Link to="/account">
                  <Button variant="ghost" size="sm">
                    Update <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {user.measurements.chest && (
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-2xl font-bold">{user.measurements.chest}"</p>
                    <p className="text-sm text-muted-foreground">Chest</p>
                  </div>
                )}
                {user.measurements.waist && (
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-2xl font-bold">{user.measurements.waist}"</p>
                    <p className="text-sm text-muted-foreground">Waist</p>
                  </div>
                )}
                {user.measurements.height && (
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-2xl font-bold">{user.measurements.height} cm</p>
                    <p className="text-sm text-muted-foreground">Height</p>
                  </div>
                )}
                {user.measurements.weight && (
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-2xl font-bold">{user.measurements.weight}</p>
                    <p className="text-sm text-muted-foreground">Weight (kg)</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Profile;
