import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Truck, CheckCircle, MapPin, Phone, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { useStore } from '@/store/useStore';
import {
  ordersAPI,
  addressesAPI,
  storeAPI,
  computeShippingFromStore,
  type AddressResponse,
  type ShippingAddressPayload,
  type StoreShippingData,
} from '@/lib/api';
import { toast } from 'sonner';
import { CURRENCY } from '@/lib/constants';

const steps = ['Shipping', 'Review'];

const DEFAULT_STORE_SHIPPING: StoreShippingData = { shippingRate: 10, freeShippingMinSubtotal: 100 };

function emptyShippingForm() {
  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    province: '',
    zip: '',
  };
}

export default function Checkout() {
  const navigate = useNavigate();
  const { cart, clearCart, isAuthenticated, user } = useStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [placing, setPlacing] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<AddressResponse[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [saveAddress, setSaveAddress] = useState(false);
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [shippingInfo, setShippingInfo] = useState(emptyShippingForm);
  const [storeShipping, setStoreShipping] = useState<StoreShippingData>(DEFAULT_STORE_SHIPPING);

  useEffect(() => {
    storeAPI
      .getShipping()
      .then((res) => {
        if (res.data) setStoreShipping(res.data);
      })
      .catch(() => setStoreShipping(DEFAULT_STORE_SHIPPING));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    addressesAPI
      .listMine()
      .then((res) => {
        const items = res.data.items ?? [];
        setSavedAddresses(items);
        const defaultAddr = items.find((a) => a.isDefault) ?? items[0];
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr._id);
          setShippingInfo((prev) => ({
            ...prev,
            address: defaultAddr.street,
            city: defaultAddr.city,
            province: defaultAddr.province,
            zip: defaultAddr.zipCode,
          }));
        }
        setShippingInfo((p) => {
          let next = { ...p };
          if (user?.name) {
            const parts = user.name.trim().split(/\s+/);
            next = { ...next, firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') ?? '' };
          }
          if (user?.email) next = { ...next, email: user.email };
          if (user?.phone) next = { ...next, phone: user.phone };
          return next;
        });
      })
      .catch(() => {
        setShippingInfo((p) => {
          let next = { ...p };
          if (user?.name) {
            const parts = user.name.trim().split(/\s+/);
            next = { ...next, firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') ?? '' };
          }
          if (user?.email) next = { ...next, email: user.email };
          if (user?.phone) next = { ...next, phone: user.phone };
          return next;
        });
      });
  }, [isAuthenticated, user?.name, user?.email, user?.phone]);

  const subtotal = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const shipping = computeShippingFromStore(subtotal, storeShipping);
  const total = subtotal + shipping;

  const handleShippingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentStep(1);
  };

  const handlePlaceOrder = async () => {
    const lineItems = cart.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
    }));
    if (lineItems.length === 0) {
      toast.error('Your cart is empty');
      return;
    }
    setPlacing(true);
    try {
      const body: Parameters<typeof ordersAPI.create>[0] = { lineItems };
      if (selectedAddressId) {
        body.addressId = selectedAddressId;
      } else {
        const ship: ShippingAddressPayload = {
          firstName: shippingInfo.firstName,
          lastName: shippingInfo.lastName,
          phone: shippingInfo.phone,
          street: shippingInfo.address,
          city: shippingInfo.city,
          province: shippingInfo.province,
          zipCode: shippingInfo.zip,
        };
        const emailTrim = shippingInfo.email.trim();
        if (emailTrim) ship.email = emailTrim;
        body.shippingAddress = ship;
        if (saveAddress) body.saveAddress = true;
        if (setAsDefault) body.setAsDefault = true;
      }
      const res = await ordersAPI.create(body);
      const orderRef = res.data?.orderNumber ?? res.data?._id;
      if (orderRef) {
        await clearCart();
        toast.success('Order placed successfully! Check WhatsApp for confirmation.');
        navigate(`/order/${orderRef}`);
      } else {
        toast.error('Order created but could not redirect');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to place order');
    } finally {
      setPlacing(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen py-12 md:py-20">
        <div className="container mx-auto px-4 text-center">
          <CheckCircle className="h-16 w-16 md:h-20 md:w-20 mx-auto text-primary mb-4 md:mb-6" />
          <h1 className="text-2xl md:text-3xl font-serif font-bold mb-3 md:mb-4 text-foreground">No Items to Checkout</h1>
          <p className="text-muted-foreground mb-6 md:mb-8">Add some items to your cart first.</p>
          <Link to="/shop"><Button size="lg">Continue Shopping</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-6 md:py-8">
      <div className="container mx-auto px-4">
        <Link to="/cart" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 md:mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Cart
        </Link>

        <h1 className="text-2xl md:text-4xl font-serif font-bold mb-6 md:mb-8 text-foreground">Checkout</h1>

        <div className="flex items-center justify-center mb-8 md:mb-12 overflow-x-auto pb-2">
          {steps.map((step, index) => (
            <div key={step} className="flex items-center flex-shrink-0">
              <div className={`flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full border-2 ${
                index <= currentStep ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground text-muted-foreground'
              }`}>
                {index < currentStep ? <CheckCircle className="h-4 w-4 md:h-5 md:w-5" /> : <span className="text-sm md:text-base">{index + 1}</span>}
              </div>
              <span className={`ml-2 text-sm md:text-base font-medium hidden sm:inline ${index <= currentStep ? 'text-foreground' : 'text-muted-foreground'}`}>
                {step}
              </span>
              {index < steps.length - 1 && (
                <div className={`w-8 md:w-16 h-0.5 mx-2 md:mx-4 ${index < currentStep ? 'bg-primary' : 'bg-muted'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
          <div className="lg:col-span-2">
            {currentStep === 0 && (
              <motion.form
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                onSubmit={handleShippingSubmit}
                className="bg-card rounded-xl border border-border p-4 md:p-6 space-y-4 md:space-y-6"
              >
                <div className="flex items-center gap-3 mb-2 md:mb-4">
                  <MapPin className="h-5 w-5 text-primary" />
                  <h2 className="text-lg md:text-xl font-semibold">Shipping Information</h2>
                </div>

                {savedAddresses.length > 0 && (
                  <div className="space-y-2">
                    <Label>Use saved address</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={selectedAddressId ?? ''}
                      onChange={(e) => {
                        const id = e.target.value || null;
                        setSelectedAddressId(id);
                        if (id) {
                          const addr = savedAddresses.find((a) => a._id === id);
                          if (addr) {
                            setShippingInfo((prev) => ({
                              ...prev,
                              address: addr.street,
                              city: addr.city,
                              province: addr.province,
                              zip: addr.zipCode,
                            }));
                          }
                        } else {
                          setShippingInfo(emptyShippingForm());
                        }
                      }}
                    >
                      <option value="">Enter new address</option>
                      {savedAddresses.map((a) => (
                        <option key={a._id} value={a._id}>
                          {a.label || 'Address'} – {a.street}, {a.city}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={shippingInfo.firstName}
                      onChange={(e) => setShippingInfo({ ...shippingInfo, firstName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={shippingInfo.lastName}
                      onChange={(e) => setShippingInfo({ ...shippingInfo, lastName: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        className="pl-10"
                        value={shippingInfo.email}
                        onChange={(e) => setShippingInfo({ ...shippingInfo, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone (WhatsApp)</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        type="tel"
                        className="pl-10"
                        value={shippingInfo.phone}
                        onChange={(e) => setShippingInfo({ ...shippingInfo, phone: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={shippingInfo.address}
                    onChange={(e) => {
                      setSelectedAddressId(null);
                      setShippingInfo({ ...shippingInfo, address: e.target.value });
                    }}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={shippingInfo.city}
                      onChange={(e) => { setSelectedAddressId(null); setShippingInfo({ ...shippingInfo, city: e.target.value }); }}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="province">Province</Label>
                    <Input
                      id="province"
                      value={shippingInfo.province}
                      onChange={(e) => { setSelectedAddressId(null); setShippingInfo({ ...shippingInfo, province: e.target.value }); }}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zip">ZIP Code</Label>
                    <Input
                      id="zip"
                      value={shippingInfo.zip}
                      onChange={(e) => { setSelectedAddressId(null); setShippingInfo({ ...shippingInfo, zip: e.target.value }); }}
                      required
                    />
                  </div>
                </div>

                {!selectedAddressId && (
                  <div className="flex flex-col gap-3 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={saveAddress} onCheckedChange={(c) => setSaveAddress(!!c)} />
                      <span className="text-sm">Save this address for next time</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={setAsDefault} onCheckedChange={(c) => setSetAsDefault(!!c)} />
                      <span className="text-sm">Set as my default address</span>
                    </label>
                  </div>
                )}

                <Button type="submit" className="w-full" size="lg">
                  Continue to review
                </Button>
              </motion.form>
            )}

            {currentStep === 1 && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-card rounded-xl border border-border p-4 md:p-6 space-y-4 md:space-y-6"
              >
                <h2 className="text-lg md:text-xl font-semibold">Review Your Order</h2>

                <div className="space-y-2">
                  <h3 className="font-medium text-muted-foreground text-sm md:text-base">Shipping To</h3>
                  <p className="text-sm md:text-base">{shippingInfo.firstName} {shippingInfo.lastName}</p>
                  <p className="text-sm md:text-base">{shippingInfo.address}</p>
                  <p className="text-sm md:text-base">{shippingInfo.city}, {shippingInfo.province} {shippingInfo.zip}</p>
                  {shippingInfo.email.trim() ? (
                    <p className="text-sm md:text-base">{shippingInfo.email}</p>
                  ) : null}
                  <p className="text-sm md:text-base">{shippingInfo.phone}</p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h3 className="font-medium text-muted-foreground text-sm md:text-base">Payment</h3>
                  <div className="flex items-center gap-2 text-sm md:text-base">
                    <Truck className="h-5 w-5 text-muted-foreground shrink-0" />
                    <span>Cash on Delivery</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3 md:space-y-4">
                  <h3 className="font-medium text-muted-foreground text-sm md:text-base">Order Items</h3>
                  {cart.map((item) => (
                    <div key={`${item.product.id}-${item.size}-${item.color}`} className="flex gap-3 md:gap-4">
                      <img src={item.product.image} alt={item.product.name} className="w-14 h-14 md:w-16 md:h-16 object-cover rounded-lg" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm md:text-base truncate">{item.product.name}</p>
                        <p className="text-xs md:text-sm text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                      <p className="font-medium text-sm md:text-base">{CURRENCY} {(item.product.price * item.quantity).toFixed(2)}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                  <Button variant="outline" onClick={() => setCurrentStep(0)} className="flex-1">
                    Back
                  </Button>
                  <Button onClick={handlePlaceOrder} className="flex-1" disabled={placing}>
                    {placing ? 'Placing…' : 'Place Order'}
                  </Button>
                </div>
              </motion.div>
            )}
          </div>

          <div className="bg-card rounded-xl border border-border p-4 md:p-6 h-fit lg:sticky lg:top-24 order-first lg:order-last">
            <h2 className="text-lg md:text-xl font-semibold mb-4 md:mb-6">Order Summary</h2>

            <div className="space-y-2 md:space-y-3 mb-4 md:mb-6 max-h-40 overflow-y-auto">
              {cart.map((item) => (
                <div key={`${item.product.id}-${item.size}`} className="flex justify-between text-xs md:text-sm">
                  <span className="text-muted-foreground truncate flex-1 mr-2">{item.product.name} x{item.quantity}</span>
                  <span>{CURRENCY} {(item.product.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <Separator className="my-4" />

            <div className="space-y-2 md:space-y-3">
              <div className="flex justify-between text-sm md:text-base">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{CURRENCY} {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm md:text-base">
                <span className="text-muted-foreground">Shipping</span>
                <span>{shipping === 0 ? 'Free' : `${CURRENCY} ${shipping.toFixed(2)}`}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-base md:text-lg">
                <span>Total</span>
                <span className="text-primary">{CURRENCY} {total.toFixed(2)}</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center mt-4 md:mt-6">
              You will receive WhatsApp confirmation after placing order
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
