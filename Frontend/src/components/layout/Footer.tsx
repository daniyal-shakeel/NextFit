import { Link } from 'react-router-dom';
import { Shirt, Instagram, Twitter, Facebook, Youtube } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function Footer() {
  return (
    <footer className="w-full min-w-0 border-t border-border bg-card">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid w-full grid-cols-1 gap-10 md:grid-cols-2 md:gap-x-10 md:gap-y-10 lg:grid-cols-4 lg:gap-x-12">
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <Shirt className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="font-serif text-2xl font-bold text-foreground">NextFit</span>
            </Link>
            <p className="text-muted-foreground">
              Discover curated fashion and try pieces on virtually before you buy—shop with confidence.
            </p>
            <div className="flex gap-4">
              <Button variant="ghost" size="icon">
                <Instagram className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon">
                <Twitter className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon">
                <Facebook className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon">
                <Youtube className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-lg mb-4 text-foreground">Quick Links</h4>
            <ul className="space-y-2">
              <li><Link to="/shop" className="text-muted-foreground hover:text-primary transition-colors">Shop All</Link></li>
              <li><Link to="/virtual-try-on" className="text-muted-foreground hover:text-primary transition-colors">Virtual Try-On</Link></li>
              <li><Link to="/cart" className="text-muted-foreground hover:text-primary transition-colors">Cart</Link></li>
              <li><Link to="/checkout" className="text-muted-foreground hover:text-primary transition-colors">Checkout</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-lg mb-4 text-foreground">Account</h4>
            <ul className="space-y-2">
              <li><Link to="/auth" className="text-muted-foreground hover:text-primary transition-colors">Sign In</Link></li>
              <li><Link to="/account" className="text-muted-foreground hover:text-primary transition-colors">My Account</Link></li>
              <li><Link to="/account?tab=orders" className="text-muted-foreground hover:text-primary transition-colors">My Orders</Link></li>
              <li><Link to="/account?tab=orders" className="text-muted-foreground hover:text-primary transition-colors">Track Order</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-lg mb-4 text-foreground">Stay Updated</h4>
            <p className="text-muted-foreground mb-4">
              Subscribe for exclusive offers and new arrivals.
            </p>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-stretch">
              <Input placeholder="Enter your email" className="min-w-0 flex-1" />
              <Button className="w-full shrink-0 sm:w-auto">Subscribe</Button>
            </div>
          </div>
        </div>

        <div className="mt-12 flex w-full flex-col items-center justify-between gap-4 border-t border-border pt-8 md:flex-row">
          <p className="text-muted-foreground text-sm">
            © 2024 NextFit. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm">
            <Link to="/privacy" className="text-muted-foreground hover:text-primary transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="text-muted-foreground hover:text-primary transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
