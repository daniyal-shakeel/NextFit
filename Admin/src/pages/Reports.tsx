import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  RefreshCw,
  ShoppingCart,
  DollarSign,
  Users,
  Package,
  LayoutGrid,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { adminAPI, type AdminUser } from "@/lib/api";
import { reportsAPI, type ReportsStats } from "@/lib/api";

function formatDate(s: string | undefined) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

export default function Reports() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ReportsStats | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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

  const fetchStats = () => {
    if (!user) return;
    setLoadingData(true);
    setError(null);
    reportsAPI
      .getStats(
        startDate || endDate
          ? { startDate: startDate || undefined, endDate: endDate || undefined }
          : undefined
      )
      .then((res) => setStats(res.data))
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load reports");
        setStats(null);
      })
      .finally(() => setLoadingData(false));
  };

  useEffect(() => {
    if (user) fetchStats();
  }, [user]);

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
        <div className="container mx-auto px-4 h-14 flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-xl font-serif font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-rose-600" />
            Reports
          </h1>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <span className="text-muted-foreground">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={fetchStats}
              disabled={loadingData}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loadingData ? "animate-spin" : ""}`} />
              {loadingData ? "Loading…" : "Apply"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 text-destructive px-4 py-2 text-sm">
            {error}
          </div>
        )}

        {!stats && !loadingData && (
          <p className="text-muted-foreground">No data. Click Apply to load reports.</p>
        )}

        {stats && (
          <div className="space-y-8">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <ShoppingCart className="h-4 w-4" />
                  Orders
                </div>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalOrders)}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <DollarSign className="h-4 w-4" />
                  Revenue
                </div>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <Users className="h-4 w-4" />
                  Customers
                </div>
                <p className="text-2xl font-bold">{formatCurrency(stats.customerCount)}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <Package className="h-4 w-4" />
                  Products
                </div>
                <p className="text-2xl font-bold">{formatCurrency(stats.productCount)}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <LayoutGrid className="h-4 w-4" />
                  Categories
                </div>
                <p className="text-2xl font-bold">{formatCurrency(stats.categoryCount)}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <AlertTriangle className="h-4 w-4" />
                  Low stock
                </div>
                <p className="text-2xl font-bold">{formatCurrency(stats.lowStockCount)}</p>
              </div>
            </div>

            {/* Orders by status */}
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <h2 className="text-lg font-semibold p-4 border-b border-border flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Orders by status
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-right p-3 font-medium">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(stats.ordersByStatus).map(([status, count]) => (
                      <tr key={status} className="border-b border-border">
                        <td className="p-3 capitalize">{status.replace(/_/g, " ")}</td>
                        <td className="p-3 text-right font-mono">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Recent orders */}
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <h2 className="text-lg font-semibold p-4 border-b border-border">
                  Recent orders
                </h2>
                {stats.recentOrders.length === 0 ? (
                  <p className="p-4 text-muted-foreground text-sm">No orders</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {stats.recentOrders.map((o) => (
                      <li key={o._id} className="p-4 flex flex-wrap justify-between items-center gap-2 text-sm">
                        <div className="min-w-0">
                          <span className="font-mono text-xs text-muted-foreground truncate block">{o._id}</span>
                          <span className="capitalize">{o.status}</span>
                          <span className="text-muted-foreground text-xs ml-2">{formatDate(o.createdAt)}</span>
                        </div>
                        <span className="font-medium shrink-0">{formatCurrency(o.total)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Low stock products */}
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <h2 className="text-lg font-semibold p-4 border-b border-border flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  Low stock products
                </h2>
                {stats.lowStockProducts.length === 0 ? (
                  <p className="p-4 text-muted-foreground text-sm">None</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {stats.lowStockProducts.map((p) => (
                      <li key={p._id} className="p-4 flex justify-between items-center text-sm">
                        <span className="font-medium truncate">{p.name}</span>
                        <span className="shrink-0 ml-2 text-amber-600 font-mono">
                          {p.stockQuantity} / {p.lowStockThreshold}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
