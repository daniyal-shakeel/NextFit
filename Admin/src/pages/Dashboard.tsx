import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LogOut,
  LayoutGrid,
  Package,
  Users,
  UserCircle,
  ShoppingCart,
  BarChart3,
  Settings,
  Boxes,
  type LucideIcon,
} from "lucide-react";
import { adminAPI, type AdminUser } from "@/lib/api";

type AppTile = {
  id: string;
  name: string;
  icon: LucideIcon;
  color: string; // tailwind text-* and bg-* classes
  path: string;
};

const APP_TILES: AppTile[] = [
  { id: "category", name: "Category", icon: LayoutGrid, color: "text-violet-600 bg-violet-100", path: "/categories" },
  { id: "product", name: "Product", icon: Package, color: "text-teal-600 bg-teal-100", path: "/products" },
  { id: "customer", name: "Customer", icon: Users, color: "text-sky-600 bg-sky-100", path: "/customers" },
  { id: "user", name: "User", icon: UserCircle, color: "text-amber-600 bg-amber-100", path: "/users" },
  { id: "order", name: "Order", icon: ShoppingCart, color: "text-emerald-600 bg-emerald-100", path: "/orders" },
  { id: "inventory", name: "Inventory", icon: Boxes, color: "text-orange-600 bg-orange-100", path: "/inventory" },
  { id: "reports", name: "Reports", icon: BarChart3, color: "text-rose-600 bg-rose-100", path: "/reports" },
  { id: "settings", name: "Settings", icon: Settings, color: "text-slate-600 bg-slate-100", path: "/settings" },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI
      .checkAuth()
      .then((res) => {
        if (res.authenticated && res.data?.user?.isAdmin) {
          setUser(res.data.user);
        } else {
          navigate("/login", { replace: true });
        }
      })
      .catch(() => navigate("/login", { replace: true }))
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await adminAPI.logout();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  const handleTileClick = (path: string) => {
    navigate(path);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-xl font-serif font-bold">NextFit Admin</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <h2 className="text-lg font-medium text-foreground mb-6">Apps</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {APP_TILES.map(({ id, name, icon: Icon, color, path }) => (
            <button
              key={id}
              type="button"
              onClick={() => handleTileClick(path)}
              className="flex flex-col items-center gap-3 p-4 rounded-xl bg-card border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <span
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-lg ${color}`}
                aria-hidden
              >
                <Icon className="h-7 w-7" />
              </span>
              <span className="text-sm font-medium text-foreground text-center leading-tight">
                {name}
              </span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
