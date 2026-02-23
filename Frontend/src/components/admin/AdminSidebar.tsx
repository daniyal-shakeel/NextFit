import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Users, 
  Package, 
  Percent, 
  Settings,
  Bell,
  LogOut,
  CheckCircle,
  Menu,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
  { icon: ShoppingCart, label: 'All Orders', path: '/admin/orders', badge: 12 },
  { icon: CheckCircle, label: 'Confirmed Orders', path: '/admin/orders/confirmed', badge: 8 },
  { icon: Users, label: 'Users', path: '/admin/users' },
  { icon: Package, label: 'Products', path: '/admin/products' },
  { icon: Percent, label: 'Discounts', path: '/admin/discounts' },
  { icon: Bell, label: 'Notifications', path: '/admin/notifications', badge: 2 },
  { icon: Settings, label: 'Settings', path: '/admin/settings' },
];

const SidebarContent = ({ onClose }: { onClose?: () => void }) => {
  const location = useLocation();

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 md:h-16 items-center justify-between border-b border-border px-4 md:px-6">
        <Link to="/admin" className="flex items-center gap-2" onClick={onClose}>
          <div className="h-7 w-7 md:h-8 md:w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xs md:text-sm">SF</span>
          </div>
          <span className="font-bold text-base md:text-lg text-foreground">Admin Panel</span>
        </Link>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="md:hidden">
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 md:p-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== '/admin' && location.pathname.startsWith(item.path));
            
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 md:py-2.5 text-sm font-medium transition-colors",
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 md:h-5 md:w-5" />
                  {item.label}
                  {item.badge && (
                    <Badge 
                      variant={isActive ? "secondary" : "default"} 
                      className="ml-auto text-xs"
                    >
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3 md:p-4">
        <Link to="/" onClick={onClose}>
          <Button variant="ghost" className="w-full justify-start gap-3 text-sm">
            <LogOut className="h-4 w-4 md:h-5 md:w-5" />
            Back to Store
          </Button>
        </Link>
      </div>
    </div>
  );
};

export const AdminSidebar = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Sidebar Trigger */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="fixed top-3 left-3 z-50 md:hidden bg-card border border-border"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64">
          <SidebarContent onClose={() => setIsOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-card border-r border-border hidden md:block">
        <SidebarContent />
      </aside>
    </>
  );
};