import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  RefreshCw,
  ShoppingCart,
  DollarSign,
  Users,
  Package,
  AlertTriangle,
  TrendingUp,
  Heart,
  Clock,
  CalendarDays,
  BarChart3,
  Percent,
  ArrowRight,
  Filter,
  LayoutGrid,
} from "lucide-react";
import {
  adminAPI,
  reportsAPI,
  inventoryAPI,
  ORDER_STATUSES,
  type AdminUser,
  type ReportsStats,
  type InventoryAnalytics,
} from "@/lib/api";
import { AdminLayout } from "@/components/layout/AdminLayout";

function formatDate(s: string | undefined) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

function formatShortDate(s: string | undefined) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString();
  } catch {
    return s;
  }
}

/** Amounts only (no currency prefix); labels add PKR where needed. */
function formatAmount(n: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatMoneyPkr(n: number) {
  return `PKR ${formatAmount(n)}`;
}

function formatPct(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function isoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function initialsFrom(name: string | undefined, email: string | undefined) {
  const n = (name ?? "").trim();
  if (n.length >= 2) return n.slice(0, 2).toUpperCase();
  const e = (email ?? "").trim();
  if (e.length >= 2) return e.slice(0, 2).toUpperCase();
  return "?";
}

function SectionTitle({
  icon: Icon,
  children,
  action,
}: {
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-muted/20 px-5 py-4">
      <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
        <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        {children}
      </h2>
      {action}
    </div>
  );
}

function ProductTable({
  rows,
  revenueLabel = "Revenue",
}: {
  rows: {
    _id: string;
    name: string;
    slug: string;
    revenue: number;
    quantity: number;
  }[];
  revenueLabel?: string;
}) {
  if (rows.length === 0) {
    return <p className="px-5 py-4 text-sm text-muted-foreground">No data for this range.</p>;
  }
  return (
    <div className="-mx-px overflow-x-auto">
      <table className="w-full min-w-[320px] text-sm">
        <thead>
          <tr className="border-b border-border/80 bg-muted/40">
            <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Product</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground">Qty</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground">{revenueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r._id}
              className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
            >
              <td className="px-4 py-3 text-left align-top">
                <div className="max-w-[220px] truncate font-medium text-foreground">{r.name}</div>
                <div className="truncate text-xs text-muted-foreground">{r.slug}</div>
              </td>
              <td className="px-4 py-3 text-right align-top font-mono text-sm tabular-nums text-foreground">
                {formatAmount(r.quantity)}
              </td>
              <td className="px-4 py-3 text-right align-top font-mono text-sm tabular-nums text-foreground">
                {formatMoneyPkr(r.revenue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type PerfTab = "revenue" | "quantity" | "refunds";

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export default function Reports() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ReportsStats | null>(null);
  const [inventory, setInventory] = useState<InventoryAnalytics | null>(null);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [perfTab, setPerfTab] = useState<PerfTab>("revenue");

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

  const fetchDashboard = useCallback(
    (range?: { startDate?: string; endDate?: string }) => {
      if (!user) return;
      setLoadingData(true);
      setError(null);
      setInventoryError(null);
      const s = range?.startDate ?? startDate;
      const e = range?.endDate ?? endDate;
      const params = s || e ? { startDate: s || undefined, endDate: e || undefined } : undefined;

      Promise.all([
        reportsAPI.getStats(params),
        inventoryAPI.analytics().catch((err: unknown) => {
          setInventoryError(err instanceof Error ? err.message : "Inventory metrics unavailable");
          return null;
        }),
      ])
        .then(([rep, inv]) => {
          setStats(rep.data);
          setInventory(inv?.success ? inv.data : null);
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Failed to load reports");
          setStats(null);
        })
        .finally(() => setLoadingData(false));
    },
    [user, startDate, endDate]
  );

  useEffect(() => {
    if (user) fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once when admin session is ready; date changes use Apply / presets
  }, [user]);

  const applyPreset = (preset: "all" | "7d" | "30d" | "month") => {
    const end = new Date();
    const endStr = isoDateLocal(end);
    if (preset === "all") {
      setStartDate("");
      setEndDate("");
      fetchDashboard({ startDate: "", endDate: "" });
      return;
    }
    if (preset === "month") {
      const start = new Date(end.getFullYear(), end.getMonth(), 1);
      const startStr = isoDateLocal(start);
      setStartDate(startStr);
      setEndDate(endStr);
      fetchDashboard({ startDate: startStr, endDate: endStr });
      return;
    }
    const days = preset === "7d" ? 7 : 30;
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    const startStr = isoDateLocal(start);
    setStartDate(startStr);
    setEndDate(endStr);
    fetchDashboard({ startDate: startStr, endDate: endStr });
  };

  const maxHourCount = useMemo(() => {
    if (!stats?.timeBased.ordersByHourUtc.length) return 1;
    return Math.max(...stats.timeBased.ordersByHourUtc.map((h) => h.count), 1);
  }, [stats]);

  const maxWeekdayCount = useMemo(() => {
    if (!stats?.timeBased.ordersByWeekdayUtc.length) return 1;
    return Math.max(...stats.timeBased.ordersByWeekdayUtc.map((d) => d.count), 1);
  }, [stats]);

  const statusRows = useMemo(() => {
    if (!stats) return [];
    return ORDER_STATUSES.map((s) => ({ status: s, count: stats.ordersByStatus[s] ?? 0 }));
  }, [stats]);

  const maxStatusCount = useMemo(() => {
    if (!statusRows.length) return 1;
    return Math.max(1, ...statusRows.map((r) => r.count));
  }, [statusRows]);

  const perfRows = useMemo(() => {
    if (!stats) return { rows: [] as ReportsStats["productPerformance"]["bestSellingByRevenue"], label: "Revenue" };
    if (perfTab === "revenue")
      return { rows: stats.productPerformance.bestSellingByRevenue, label: "Revenue" };
    if (perfTab === "quantity")
      return { rows: stats.productPerformance.bestSellingByQuantity, label: "Revenue" };
    return { rows: stats.productPerformance.mostRefundedProducts, label: "Refund total" };
  }, [stats, perfTab]);

  const funnelSteps = useMemo(() => {
    if (!stats) return [];
    const delivered = stats.ordersByStatus.delivered ?? 0;
    return [
      { key: "placed", label: "Orders in range", value: stats.totalOrders },
      { key: "revenue", label: "Revenue pipeline", value: stats.revenueOrderCount },
      { key: "delivered", label: "Delivered", value: delivered },
    ];
  }, [stats]);

  const funnelMax = useMemo(() => Math.max(1, ...funnelSteps.map((s) => s.value)), [funnelSteps]);

  const activeCustomers = stats?.activeCustomerCount ?? stats?.customerCount ?? 0;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <AdminLayout title="Reports" userEmail={user?.email}>
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 border-b border-border/80 pb-6">
          <p className="text-sm text-muted-foreground">
            Figures reflect your database for the selected period. Cart and wishlist metrics are lifetime snapshots;
            order metrics respect the date range below (UTC boundaries for rolling charts).
          </p>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-wrap gap-2">
              <span className="mr-1 flex items-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Filter className="mr-1 h-3.5 w-3.5" />
                Range
              </span>
              <button
                type="button"
                onClick={() => applyPreset("all")}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted/60"
              >
                All time
              </button>
              <button
                type="button"
                onClick={() => applyPreset("7d")}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted/60"
              >
                Last 7 days
              </button>
              <button
                type="button"
                onClick={() => applyPreset("30d")}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted/60"
              >
                Last 30 days
              </button>
              <button
                type="button"
                onClick={() => applyPreset("month")}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted/60"
              >
                This month
              </button>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10 min-w-0 rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10 min-w-0 rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
              />
              <button
                type="button"
                onClick={() => fetchDashboard()}
                disabled={loadingData}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loadingData ? "animate-spin" : ""}`} />
                {loadingData ? "Loading…" : "Apply"}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {inventoryError && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            {inventoryError}
          </div>
        )}

        {!stats && !loadingData && <p className="text-muted-foreground">No data loaded.</p>}

        {stats && (
          <div className="flex flex-col gap-6">
            {/* Executive overview */}
            <section aria-label="Executive overview">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex min-h-[7.25rem] flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm ring-1 ring-border/40">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <DollarSign className="h-4 w-4 opacity-80" aria-hidden />
                    Total revenue
                  </div>
                  <p className="mt-3 text-2xl font-bold tabular-nums text-foreground">
                    {formatMoneyPkr(stats.totalRevenue)}
                  </p>
                  <p className="text-xs text-muted-foreground">Pending–delivered orders in range</p>
                </div>
                <div className="flex min-h-[7.25rem] flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm ring-1 ring-border/40">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <ShoppingCart className="h-4 w-4 opacity-80" aria-hidden />
                    Total orders
                  </div>
                  <p className="mt-3 text-2xl font-bold tabular-nums text-foreground">{formatAmount(stats.totalOrders)}</p>
                  <p className="text-xs text-muted-foreground">All statuses in range</p>
                </div>
                <div className="flex min-h-[7.25rem] flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm ring-1 ring-border/40">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Users className="h-4 w-4 opacity-80" aria-hidden />
                    Active accounts
                  </div>
                  <p className="mt-3 text-2xl font-bold tabular-nums text-foreground">{formatAmount(activeCustomers)}</p>
                  <p className="text-xs text-muted-foreground">Non-suspended customers</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                <div className="flex min-h-[7rem] flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm ring-1 ring-border/40">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <BarChart3 className="h-4 w-4 opacity-80" aria-hidden />
                    AOV
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">
                    {formatMoneyPkr(stats.averageOrderValue)}
                  </p>
                  {stats.averageOrderValueChangePercent !== null && startDate && endDate ? (
                    <p className="text-xs text-muted-foreground">
                      vs prior window: {formatPct(stats.averageOrderValueChangePercent)}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Revenue ÷ revenue orders</p>
                  )}
                </div>
                <div className="flex min-h-[7rem] flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm ring-1 ring-border/40">
                  <div className="text-xs font-medium text-muted-foreground">Refund total</div>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{formatMoneyPkr(stats.refundTotal)}</p>
                  <p className="text-xs text-muted-foreground">Refunded &amp; partial</p>
                </div>
                <div className="flex min-h-[7rem] flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm ring-1 ring-border/40">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Package className="h-4 w-4 opacity-80" aria-hidden />
                    In-stock (healthy)
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">
                    {inventory != null ? formatAmount(inventory.inStockHealthyCount) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">Live catalog (not range-scoped)</p>
                </div>
                <div className="flex min-h-[7rem] flex-col justify-between rounded-xl border border-amber-500/25 bg-amber-500/5 p-5 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <AlertTriangle className="h-4 w-4 text-amber-700 opacity-90 dark:text-amber-300" aria-hidden />
                    Low stock SKUs
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-amber-800 dark:text-amber-200">
                    {formatAmount(stats.lowStockCount)}
                  </p>
                  <p className="text-xs text-muted-foreground">At or below threshold</p>
                </div>
              </div>
            </section>

            {/* Performance + funnel */}
            <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
              <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm ring-1 ring-border/40">
                <SectionTitle icon={Package}>Product leaderboard</SectionTitle>
                <div className="flex flex-wrap gap-2 border-b border-border/80 px-5 py-3">
                  {(
                    [
                      ["revenue", "Revenue"],
                      ["quantity", "Quantity"],
                      ["refunds", "Refunds"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPerfTab(id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        perfTab === id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/60 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <ProductTable rows={perfRows.rows} revenueLabel={perfRows.label} />
              </div>

              <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm ring-1 ring-border/40">
                <SectionTitle icon={TrendingUp}>Order pipeline</SectionTitle>
                <div className="space-y-4 px-5 py-5">
                  <p className="text-sm text-muted-foreground">
                    Relative widths use the largest step as 100%. Counts use the same date filter as orders above.
                  </p>
                  <div className="space-y-3">
                    {funnelSteps.map((step) => (
                      <div key={step.key}>
                        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{step.label}</span>
                          <span className="font-mono tabular-nums text-foreground">{formatAmount(step.value)}</span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary/80 transition-all"
                            style={{ width: `${(step.value / funnelMax) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg border border-border/80 bg-muted/20 p-4">
                    <p className="text-xs font-medium text-muted-foreground">Cart abandonment (lifetime carts)</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                      {formatPct(stats.cartConversion.cartAbandonmentRatePercent)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {stats.cartConversion.cartsWithItemsNoRevenueOrderCount} of{" "}
                      {stats.cartConversion.cartsWithItemsCount} carts with items have no purchase yet.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Customer engagement */}
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm ring-1 ring-border/40">
              <SectionTitle icon={Users}>Customer engagement</SectionTitle>
              <div className="grid gap-0 md:grid-cols-2 md:divide-x md:divide-border/80">
                <div className="min-w-0">
                  <h3 className="border-b border-border/80 bg-muted/30 px-5 py-3 text-sm font-semibold text-foreground">
                    Top spenders (range)
                  </h3>
                  {stats.revenueInsights.topCustomersBySpend.length === 0 ? (
                    <p className="px-5 py-4 text-sm text-muted-foreground">No data</p>
                  ) : (
                    <ul className="divide-y divide-border/80">
                      {stats.revenueInsights.topCustomersBySpend.map((c) => (
                        <li key={c._id} className="flex items-start gap-3 px-5 py-3 text-sm">
                          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="truncate font-medium text-foreground">{c.name ?? "—"}</span>
                            <span className="truncate text-xs text-muted-foreground">{c.email ?? c.customerId ?? ""}</span>
                            <span className="text-xs text-muted-foreground">
                              Last order: {formatShortDate(c.lastOrderAt)}
                            </span>
                          </div>
                          <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">
                            {formatMoneyPkr(c.totalSpend)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="border-b border-border/80 bg-muted/30 px-5 py-3 text-sm font-semibold text-foreground">
                    Recent logins
                  </h3>
                  {(stats.customerRecentLogins ?? []).length === 0 ? (
                    <p className="px-5 py-4 text-sm text-muted-foreground">No login timestamps recorded.</p>
                  ) : (
                    <ul className="divide-y divide-border/80">
                      {(stats.customerRecentLogins ?? []).map((c) => (
                        <li key={String(c._id)} className="flex items-center gap-3 px-5 py-3 text-sm">
                          {c.avatar?.startsWith("http") ? (
                            <img
                              src={c.avatar}
                              alt=""
                              className="h-9 w-9 shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                              {initialsFrom(c.name, c.email)}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium text-foreground">{c.name ?? c.email ?? "—"}</div>
                            <div className="truncate text-xs text-muted-foreground">{c.email ?? c.customerId ?? ""}</div>
                          </div>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {formatShortDate(c.lastLoginAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* Cart & conversion detail */}
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm ring-1 ring-border/40">
              <SectionTitle icon={ShoppingCart}>Cart &amp; conversion</SectionTitle>
              <div className="grid gap-4 px-5 pb-5 pt-2 md:grid-cols-2 md:gap-6">
                <div className="flex min-h-0 flex-col gap-4">
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/80 bg-card">
                    <h3 className="border-b border-border/80 bg-muted/30 px-4 py-3 text-sm font-semibold text-foreground">
                      In cart, not purchased (top)
                    </h3>
                    {stats.cartConversion.abandonedCartProducts.length === 0 ? (
                      <p className="px-4 py-4 text-sm text-muted-foreground">None</p>
                    ) : (
                      <ul className="max-h-72 divide-y divide-border/80 overflow-y-auto">
                        {stats.cartConversion.abandonedCartProducts.map((r) => (
                          <li key={r.productId} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                            <span className="min-w-0 flex-1 truncate font-medium text-foreground">{r.name}</span>
                            <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">
                              {r.quantityInCarts} in carts
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <div className="flex min-h-0 flex-col gap-4">
                  <div className="rounded-lg border border-border/80 bg-muted/20 p-4">
                    <p className="text-xs font-medium text-muted-foreground">Repeat vs one-time buyers</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Repeat:{" "}
                      <span className="font-semibold text-foreground">{stats.customerInsights.repeatBuyers}</span> ·
                      One-time:{" "}
                      <span className="font-semibold text-foreground">{stats.customerInsights.oneTimeBuyers}</span>
                      <span className="text-sm"> (users with revenue orders in range)</span>
                    </p>
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/80 bg-card">
                    <h3 className="flex items-center gap-2 border-b border-border/80 bg-muted/30 px-4 py-3 text-sm font-semibold text-foreground">
                      <Heart className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                      Wishlisted, not purchased (top)
                    </h3>
                    {stats.cartConversion.wishlistedNotPurchased.length === 0 ? (
                      <p className="px-4 py-4 text-sm text-muted-foreground">None</p>
                    ) : (
                      <ul className="max-h-72 divide-y divide-border/80 overflow-y-auto">
                        {stats.cartConversion.wishlistedNotPurchased.map((r) => (
                          <li key={r.productId} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                            <span className="min-w-0 flex-1 truncate font-medium text-foreground">{r.name}</span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">{r.interestedUsers} users</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
              <div className="border-t border-border/80 px-5 pb-5 pt-4">
                <h3 className="border-b border-border/80 bg-muted/30 px-4 py-3 text-sm font-semibold text-foreground">
                  Customers with carts, no revenue order yet
                </h3>
                {stats.cartConversion.customersWithAbandonedCarts.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-muted-foreground">None</p>
                ) : (
                  <ul className="divide-y divide-border/80">
                    {stats.cartConversion.customersWithAbandonedCarts.map((c) => (
                      <li
                        key={String(c.userId)}
                        className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm md:grid md:grid-cols-[1fr_1fr_minmax(0,auto)_auto] md:items-center"
                      >
                        <span className="min-w-0 font-medium text-foreground">{c.name ?? "—"}</span>
                        <span className="min-w-0 truncate text-muted-foreground" title={c.email}>
                          {c.email ?? "—"}
                        </span>
                        <span className="text-xs text-muted-foreground">{c.customerId ?? ""}</span>
                        <span className="ml-auto font-mono text-xs tabular-nums text-foreground md:ml-0 md:text-right">
                          {c.cartItemCount} lines
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* More product signals */}
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm ring-1 ring-border/40">
              <SectionTitle icon={LayoutGrid}>Additional product signals</SectionTitle>
              <div className="grid min-h-0 gap-4 p-5 lg:grid-cols-2 lg:items-stretch">
                <div className="flex min-h-[12rem] flex-col overflow-hidden rounded-xl border border-border/80 bg-card">
                  <h3 className="border-b border-border/80 bg-muted/30 px-4 py-3 text-sm font-semibold text-foreground">
                    Lowest sales — quantity
                  </h3>
                  <ProductTable rows={stats.productPerformance.worstSellingByQuantity} />
                </div>
                <div className="flex min-h-[12rem] flex-col overflow-hidden rounded-xl border border-border/80 bg-card">
                  <h3 className="border-b border-border/80 bg-muted/30 px-4 py-3 text-sm font-semibold text-foreground">
                    Most cancelled
                  </h3>
                  <ProductTable rows={stats.productPerformance.mostCancelledProducts} />
                </div>
              </div>
            </div>

            {/* Revenue by category + rolling */}
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm ring-1 ring-border/40">
              <SectionTitle icon={DollarSign}>Revenue insights</SectionTitle>
              <div className="grid gap-0 md:grid-cols-2 md:divide-x md:divide-border/80">
                <div className="min-w-0">
                  <h3 className="border-b border-border/80 bg-muted/30 px-5 py-3 text-sm font-semibold text-foreground">
                    Revenue by category
                  </h3>
                  {stats.revenueInsights.revenueByCategory.length === 0 ? (
                    <p className="px-5 py-4 text-sm text-muted-foreground">No data</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[260px] text-sm">
                        <thead>
                          <tr className="border-b border-border/80 bg-muted/40">
                            <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Category</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground">Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.revenueInsights.revenueByCategory.map((c) => (
                            <tr
                              key={String(c.categoryId)}
                              className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
                            >
                              <td className="px-4 py-3 text-left text-sm font-medium text-foreground">{c.name}</td>
                              <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-foreground">
                                {formatMoneyPkr(c.revenue)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="min-w-0 px-5 py-5">
                  <p className="mb-3 text-sm font-medium text-muted-foreground">Rolling revenue (pending–delivered, UTC)</p>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Last 7 days</span>
                      <span className="text-right font-mono text-xl font-bold tabular-nums text-foreground">
                        {formatMoneyPkr(stats.timeBased.revenueLast7Days)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Previous 7 days</span>
                      <span className="text-right font-mono text-sm tabular-nums text-foreground">
                        {formatMoneyPkr(stats.timeBased.revenuePrevious7Days)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">WoW change</span>
                      <span className="text-right font-mono text-sm tabular-nums text-foreground">
                        {formatPct(stats.timeBased.revenueWowChangePercent)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-border/80 pt-3">
                      <span className="text-muted-foreground">Last 30 days</span>
                      <span className="text-right font-mono text-xl font-bold tabular-nums text-foreground">
                        {formatMoneyPkr(stats.timeBased.revenueLast30Days)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Previous 30 days</span>
                      <span className="text-right font-mono text-sm tabular-nums text-foreground">
                        {formatMoneyPkr(stats.timeBased.revenuePrevious30Days)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">MoM change</span>
                      <span className="text-right font-mono text-sm tabular-nums text-foreground">
                        {formatPct(stats.timeBased.revenueMomChangePercent)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Orders by status + recent + low stock */}
            <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
              <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm ring-1 ring-border/40">
                <SectionTitle icon={BarChart3}>Orders by status</SectionTitle>
                <div className="space-y-3 px-5 py-5">
                  {statusRows.map(({ status, count }) => (
                    <div key={status}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                        <span className="inline-flex h-6 max-w-[70%] items-center rounded-full border border-border/80 bg-muted/40 px-2.5 text-xs font-medium capitalize text-foreground">
                          {statusLabel(status)}
                        </span>
                        <span className="font-mono tabular-nums text-foreground">{formatAmount(count)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary/75"
                          style={{ width: `${(count / maxStatusCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border/80">
                  <div className="flex items-center justify-between border-b border-border/80 bg-muted/20 px-5 py-3">
                    <h3 className="text-sm font-semibold text-foreground">Recent orders</h3>
                    <Link
                      to="/orders"
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      View all
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                  {stats.recentOrders.length === 0 ? (
                    <p className="px-5 py-4 text-sm text-muted-foreground">No orders</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[280px] text-sm">
                        <thead>
                          <tr className="border-b border-border/80 bg-muted/40">
                            <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">When</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Order</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Status</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.recentOrders.map((o) => (
                            <tr key={o._id} className="border-b border-border/60 last:border-0">
                              <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                                {formatDate(o.createdAt)}
                              </td>
                              <td className="max-w-[140px] truncate px-4 py-2.5 font-mono text-xs text-foreground">
                                {o.orderNumber ?? o._id}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="inline-flex h-6 items-center rounded-full border border-border/80 bg-muted/40 px-2 text-xs font-medium capitalize text-foreground">
                                  {o.status}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold tabular-nums text-foreground">
                                {formatMoneyPkr(o.total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-amber-500/25 bg-amber-500/5 shadow-sm ring-1 ring-amber-500/20">
                <SectionTitle
                  icon={AlertTriangle}
                  action={
                    <Link
                      to="/inventory"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Manage inventory
                    </Link>
                  }
                >
                  Low stock
                </SectionTitle>
                {stats.lowStockProducts.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-muted-foreground">None</p>
                ) : (
                  <ul className="flex flex-1 flex-col divide-y divide-amber-500/15 overflow-y-auto">
                    {stats.lowStockProducts.map((p) => (
                      <li key={p._id} className="flex items-center justify-between gap-3 px-5 py-4 text-sm">
                        <span className="min-w-0 flex-1 truncate font-medium text-foreground">{p.name}</span>
                        <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-amber-500/15 px-2.5 font-mono text-xs font-medium tabular-nums text-amber-800 dark:text-amber-200">
                          {p.stockQuantity} / {p.lowStockThreshold}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Time-based */}
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm ring-1 ring-border/40">
              <SectionTitle icon={Clock}>Time-based (UTC)</SectionTitle>
              <div className="grid gap-4 border-b border-border/80 px-5 py-5 md:grid-cols-2 md:gap-6">
                <div className="min-w-0">
                  <p className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <CalendarDays className="h-4 w-4 shrink-0" />
                    Orders by weekday
                  </p>
                  <div className="flex h-32 min-w-0 items-end gap-1 overflow-x-auto pb-0.5">
                    {stats.timeBased.ordersByWeekdayUtc.map((d) => (
                      <div key={d.weekday} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                        <div
                          className="w-full min-h-[4px] rounded-t bg-primary/80 transition-all"
                          style={{ height: `${(d.count / maxWeekdayCount) * 100}%` }}
                          title={`${d.label}: ${d.count}`}
                        />
                        <span className="w-full truncate text-center text-xs text-muted-foreground">{d.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="mb-3 text-sm font-medium text-muted-foreground">Orders by hour</p>
                  <div className="flex h-28 min-w-0 items-end gap-0.5 overflow-x-auto pb-1">
                    {stats.timeBased.ordersByHourUtc.map((h) => (
                      <div key={h.hour} className="flex w-5 shrink-0 flex-col items-center gap-1">
                        <div
                          className="min-h-[2px] w-full rounded-t bg-primary/70 transition-all"
                          style={{ height: `${(h.count / maxHourCount) * 100}%` }}
                          title={`${h.hour}:00 — ${h.count}`}
                        />
                        <span className="text-xs text-muted-foreground">{h.hour}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Refund rate callout */}
        {stats && (
          <div className="rounded-xl border border-border bg-muted/20 px-5 py-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2 font-medium text-foreground">
              <Percent className="h-4 w-4" />
              Refund rate
            </span>
            <span className="ml-2 tabular-nums text-foreground">{formatPct(stats.refundRatePercent)}</span>
            <span className="ml-1">of gross (revenue + refunds) in range.</span>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
