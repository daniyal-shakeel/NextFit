import { Link } from 'react-router-dom';
import { Shirt, Instagram, Twitter, Facebook, Youtube } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFeatureConfig } from '@/lib/featureConfig';

export function Footer() {
  const { comingSoonEnabled } = useFeatureConfig();

  return (
    <footer className="bg-card border-t border-border">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <Shirt className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="font-serif text-2xl font-bold">NextFit</span>
            </Link>
            <p className="text-muted-foreground">
              Create your unique style with our customizable fashion platform. Express yourself through personalized designs.
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

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-lg mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li><Link to="/shop" className="text-muted-foreground hover:text-primary transition-colors">Shop All</Link></li>
              <li className="flex items-center gap-2">
                <Link to="/customize" className="text-muted-foreground hover:text-primary transition-colors">Customize</Link>
                {comingSoonEnabled && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">Coming Soon</Badge>}
              </li>
              <li><Link to="/virtual-try-on" className="text-muted-foreground hover:text-primary transition-colors">Virtual Try-On</Link></li>
              <li className="flex items-center gap-2">
                <Link to="/assistant" className="text-muted-foreground hover:text-primary transition-colors">AI Assistant</Link>
                {comingSoonEnabled && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">Coming Soon</Badge>}
              </li>
              <li><Link to="/cart" className="text-muted-foreground hover:text-primary transition-colors">Cart</Link></li>
              <li><Link to="/checkout" className="text-muted-foreground hover:text-primary transition-colors">Checkout</Link></li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="font-semibold text-lg mb-4">Account</h4>
            <ul className="space-y-2">
              <li><Link to="/auth" className="text-muted-foreground hover:text-primary transition-colors">Sign In</Link></li>
              <li><Link to="/account" className="text-muted-foreground hover:text-primary transition-colors">My Account</Link></li>
              <li><Link to="/account" className="text-muted-foreground hover:text-primary transition-colors">My Orders</Link></li>
              <li><Link to="/account" className="text-muted-foreground hover:text-primary transition-colors">Track Order</Link></li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="font-semibold text-lg mb-4">Stay Updated</h4>
            <p className="text-muted-foreground mb-4">
              Subscribe for exclusive offers and new arrivals.
            </p>
            <div className="flex gap-2">
              <Input placeholder="Enter your email" className="flex-1" />
              <Button>Subscribe</Button>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
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
