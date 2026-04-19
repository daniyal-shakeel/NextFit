import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutGrid,
  Package,
  Users,
  UserCircle,
  ShoppingCart,
  BarChart3,
  Settings,
  Boxes,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { adminAPI, type AdminUser } from "@/lib/api";
import { AdminLayout } from "@/components/layout/AdminLayout";

type SectionCard = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  iconWrap: string;
  path: string;
};

const SECTIONS: SectionCard[] = [
  {
    id: "category",
    name: "Categories",
    description: "Create and manage categories with cover images",
    icon: LayoutGrid,
    iconWrap: "bg-violet-100 text-violet-600 dark:bg-violet-950/55 dark:text-violet-300",
    path: "/categories",
  },
  {
    id: "product",
    name: "Products",
    description: "Add, edit, and remove products in your catalog",
    icon: Package,
    iconWrap: "bg-teal-100 text-teal-600 dark:bg-teal-950/55 dark:text-teal-300",
    path: "/products",
  },
  {
    id: "order",
    name: "Orders",
    description: "Track and update order status across the store",
    icon: ShoppingCart,
    iconWrap: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/55 dark:text-emerald-300",
    path: "/orders",
  },
  {
    id: "customer",
    name: "Customers",
    description: "View shopper accounts, activity, and addresses",
    icon: Users,
    iconWrap: "bg-sky-100 text-sky-600 dark:bg-sky-950/55 dark:text-sky-300",
    path: "/customers",
  },
  {
    id: "user",
    name: "Users",
    description: "Browse registered users and login history",
    icon: UserCircle,
    iconWrap: "bg-amber-100 text-amber-600 dark:bg-amber-950/55 dark:text-amber-300",
    path: "/users",
  },
  {
    id: "inventory",
    name: "Inventory",
    description: "Adjust stock levels and low-stock thresholds",
    icon: Boxes,
    iconWrap: "bg-orange-100 text-orange-600 dark:bg-orange-950/55 dark:text-orange-300",
    path: "/inventory",
  },
  {
    id: "reports",
    name: "Reports",
    description: "Revenue, orders, and catalog health at a glance",
    icon: BarChart3,
    iconWrap: "bg-rose-100 text-rose-600 dark:bg-rose-950/55 dark:text-rose-300",
    path: "/reports",
  },
  {
    id: "settings",
    name: "Settings",
    description: "Integrations, defaults, and AI feature toggles",
    icon: Settings,
    iconWrap: "bg-slate-100 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300",
    path: "/settings",
  },
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <AdminLayout title="Dashboard" userEmail={user?.email}>
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground">
              N
            </div>
            <div>
              <h2 className="font-sans text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                Welcome to the Admin Console
              </h2>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Manage categories, products, orders, and store settings from one place. Pick a section below or use the
                sidebar.
              </p>
            </div>
          </div>
        </div>

        <div>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Sections</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {SECTIONS.map(({ id, name, description, icon: Icon, iconWrap, path }) => (
              <button
                key={id}
                type="button"
                onClick={() => navigate(path)}
                className="group flex w-full items-stretch gap-4 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/25 hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconWrap}`}
                  aria-hidden
                >
                  <Icon className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1 py-0.5">
                  <p className="font-sans font-semibold text-foreground">{name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                </div>
                <ChevronRight
                  className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
