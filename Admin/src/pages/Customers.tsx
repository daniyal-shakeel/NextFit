import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { CloudDownload, Eye, Filter, RefreshCw, UserCircle, X } from "lucide-react";
import {
  adminAPI,
  type AdminUser,
  customersAPI,
  type CustomerItem,
} from "@/lib/api";
import { formatIsoDate } from "@/lib/formatIsoDate";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { ScrollTopBottomButtons } from "@/components/ScrollTopBottomButtons";
import { ADMIN_QUERY_STALE_MS } from "@/lib/queryClient";

const PAGE_SIZE = 10;

const adminCustomersKey = ["admin", "customers"] as const;

type CustomerFilters = {
  status: string;
  authMethod: string;
};

function emptyFilters(): CustomerFilters {
  return { status: "", authMethod: "" };
}

function displayEmail(c: CustomerItem) {
  return c.email ?? c.googleEmail ?? "—";
}

function formatMoney(amount: number, currency: string | undefined) {
  const c = currency?.trim() || "PKR";
  if (Number.isNaN(Number(amount))) return `${c} —`;
  return `${c} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatTableDate(s: string | undefined) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

function customerMatchesSearch(c: CustomerItem, q: string): boolean {
  const qq = q.trim().toLowerCase();
  if (!qq) return true;
  if ((c.customerId ?? "").toLowerCase().includes(qq)) return true;
  if (c._id.toLowerCase().includes(qq)) return true;
  if ((c.name ?? "").toLowerCase().includes(qq)) return true;
  if ((c.email ?? "").toLowerCase().includes(qq)) return true;
  if ((c.googleEmail ?? "").toLowerCase().includes(qq)) return true;
  if ((c.phone ?? "").toLowerCase().includes(qq)) return true;
  if ((c.authMethod ?? "").toLowerCase().includes(qq)) return true;
  if ((c.accountStatus ?? "").toLowerCase().includes(qq)) return true;
  return false;
}

function HighPayingTag() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-violet-500/35 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-200">
      High paying
    </span>
  );
}

const AUTH_OPTIONS = [
  { value: "", label: "All methods" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "google", label: "Google" },
] as const;

export default function Customers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewIdFromUrl = searchParams.get("view");
  const openedViewIdRef = useRef<string | null>(null);
  const customerDetailRef = useRef<HTMLElement | null>(null);

  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullCatalogLoaded, setFullCatalogLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<CustomerFilters>(() => emptyFilters());
  const [draftFilters, setDraftFilters] = useState<CustomerFilters>(appliedFilters);

  const [selected, setSelected] = useState<CustomerItem | null>(null);
  const [customerDetailVisible, setCustomerDetailVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewDetail, setViewDetail] = useState<CustomerItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

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

  const customersInfinite = useInfiniteQuery({
    queryKey: [
      ...adminCustomersKey,
      "paginated",
      appliedFilters.status,
      appliedFilters.authMethod,
    ],
    enabled: Boolean(user) && !fullCatalogLoaded,
    initialPageParam: 0,
    staleTime: ADMIN_QUERY_STALE_MS,
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      const res = await customersAPI.list(
        listQuery(appliedFilters, { limit: PAGE_SIZE, skip: pageParam })
      );
      return res.data;
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      const loaded = allPages.reduce((sum, p) => sum + (p.items?.length ?? 0), 0);
      return loaded;
    },
  });

  const customersFull = useQuery({
    queryKey: [
      ...adminCustomersKey,
      "full",
      appliedFilters.status,
      appliedFilters.authMethod,
    ],
    queryFn: async () => {
      const res = await customersAPI.list(listQuery(appliedFilters, {}));
      return res.data;
    },
    enabled: Boolean(user) && fullCatalogLoaded,
    staleTime: ADMIN_QUERY_STALE_MS,
  });

  const items = useMemo((): CustomerItem[] => {
    if (fullCatalogLoaded && customersFull.data) {
      return customersFull.data.items ?? [];
    }
    return customersInfinite.data?.pages.flatMap((p) => p.items ?? []) ?? [];
  }, [fullCatalogLoaded, customersFull.data, customersInfinite.data]);

  const lastInfinitePage =
    customersInfinite.data?.pages[customersInfinite.data.pages.length - 1];
  const total = fullCatalogLoaded
    ? (customersFull.data?.total ?? items.length)
    : (lastInfinitePage?.total ?? null);
  const hasMore = fullCatalogLoaded ? false : Boolean(lastInfinitePage?.hasMore);

  const loadingList = fullCatalogLoaded
    ? customersFull.isLoading && !customersFull.data
    : customersInfinite.isLoading && !customersInfinite.data;
  const loadingMore = customersInfinite.isFetchingNextPage;
  const loadingForce = fullCatalogLoaded && customersFull.isFetching;

  const listFetchError =
    (fullCatalogLoaded ? customersFull.error : customersInfinite.error) ?? null;
  const displayError =
    error ??
    (listFetchError instanceof Error
      ? listFetchError.message
      : listFetchError
        ? String(listFetchError)
        : null);

  useEffect(() => {
    if (!user || !viewIdFromUrl || openedViewIdRef.current === viewIdFromUrl) return;
    openedViewIdRef.current = viewIdFromUrl;
    setCustomerDetailVisible(true);
    setSelected({ _id: viewIdFromUrl } as CustomerItem);
    setViewDetail(null);
    setLoadingDetail(true);
    setError(null);
    requestAnimationFrame(() => {
      customerDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    customersAPI
      .get(viewIdFromUrl)
      .then((custRes) => {
        setViewDetail(custRes.data);
        setSelected(custRes.data);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load customer details");
      })
      .finally(() => {
        setLoadingDetail(false);
        setSearchParams((p) => {
          p.delete("view");
          return p;
        });
      });
  }, [user, viewIdFromUrl, setSearchParams]);

  const handleLoadMore = () => {
    if (fullCatalogLoaded || !hasMore || loadingMore) return;
    void customersInfinite.fetchNextPage();
  };

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: [...adminCustomersKey] });
  };

  const openFilters = () => {
    setDraftFilters(appliedFilters);
    setFiltersOpen(true);
  };

  const applySidebarFilters = () => {
    setAppliedFilters(draftFilters);
    setFullCatalogLoaded(false);
    setFiltersOpen(false);
  };

  const resetDraftFilters = () => {
    setDraftFilters(emptyFilters());
  };

  const openView = async (c: CustomerItem) => {
    setSelected(c);
    setCustomerDetailVisible(true);
    setViewDetail(null);
    setLoadingDetail(true);
    setError(null);
    requestAnimationFrame(() => {
      customerDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    try {
      const custRes = await customersAPI.get(c._id);
      setViewDetail(custRes.data);
      setSelected(custRes.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load customer details");
    } finally {
      setLoadingDetail(false);
    }
  };

  const hideDetail = () => {
    setCustomerDetailVisible(false);
    setSelected(null);
    setViewDetail(null);
    openedViewIdRef.current = null;
  };

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return items;
    return items.filter((c) => customerMatchesSearch(c, q));
  }, [items, searchQuery]);

  const showSearchNoMatches =
    searchQuery.trim().length > 0 &&
    filteredItems.length === 0 &&
    items.length > 0 &&
    !fullCatalogLoaded &&
    hasMore;

  const activeFilterCount =
    (appliedFilters.status ? 1 : 0) + (appliedFilters.authMethod ? 1 : 0);

  const refreshIconSpin = fullCatalogLoaded
    ? customersFull.isFetching
    : Boolean(customersInfinite.isFetching && !customersInfinite.isFetchingNextPage);

  const detail = viewDetail ?? selected;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <AdminLayout title="Customers" userEmail={user?.email}>
      <div className="mx-auto max-w-6xl">
        <div className="sticky top-14 z-20 -mx-4 mb-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
            <div className="flex shrink-0 flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => void handleRefresh()}
                disabled={loadingList && items.length === 0}
                title="Fetch latest from database"
                aria-label="Fetch latest customers from database"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-800/70"
              >
                <RefreshCw className={`h-4 w-4 ${refreshIconSpin ? "animate-spin" : ""}`} aria-hidden />
              </button>
              <button
                type="button"
                onClick={openFilters}
                title="Filters"
                aria-label="Open customer filters"
                className={`relative flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-sm font-medium shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  activeFilterCount > 0 ? "border-primary/40 bg-primary/5" : ""
                }`}
              >
                <Filter className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Filters</span>
                {activeFilterCount > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
            </div>
            <div className="min-w-0 flex-1 basis-[min(100%,12rem)] sm:basis-64">
              <label htmlFor="customer-search" className="sr-only">
                Search loaded customers
              </label>
              <input
                id="customer-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by name, email, phone, customer ID…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                autoComplete="off"
              />
            </div>
            <button
              type="button"
              onClick={() => setFullCatalogLoaded(true)}
              disabled={loadingForce || loadingList}
              title="Force load all customers from database matching current filters (may take longer)"
              aria-label={loadingForce ? "Loading all customers" : "Force load all customers from database"}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/40 bg-card text-amber-700 hover:bg-amber-500/10 dark:text-amber-300 disabled:opacity-50"
            >
              {loadingForce ? (
                <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <CloudDownload className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
        </div>

        <p className="mb-4 text-xs text-amber-700 dark:text-amber-200/90">
          Force load fetches every matching customer at once. Use filters to narrow the list first.
        </p>

        {displayError && (
          <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
            {displayError}
          </div>
        )}

        {showSearchNoMatches && (
          <div className="mb-4 rounded-md border border-amber-500/50 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            No match in the customers currently loaded. Try &quot;Load more customers&quot; — the
            customer you want may appear after loading more.
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm ring-1 ring-border/40">
          {loadingList ? (
            <div className="p-8 text-center text-muted-foreground">Loading customers...</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No customers found.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/40">
                    <tr>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Customer ID
                      </th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Name
                      </th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Email / Phone
                      </th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Auth
                      </th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Status
                      </th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Created
                      </th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((c) => (
                      <tr
                        key={c._id}
                        className="border-b border-border/80 last:border-0 transition-colors hover:bg-muted/25"
                      >
                        <td className="px-4 py-3.5 align-top font-mono text-xs text-muted-foreground">
                          {c.customerId ?? "—"}
                        </td>
                        <td className="px-4 py-3.5 align-top font-medium text-foreground">
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{c.name ?? "—"}</span>
                            {c.highPaying ? <HighPayingTag /> : null}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 align-top text-muted-foreground">
                          <span className="text-foreground">{displayEmail(c)}</span>
                          {c.phone ? (
                            <>
                              <span className="text-border"> / </span>
                              <span>{c.phone}</span>
                            </>
                          ) : null}
                        </td>
                        <td className="px-4 py-3.5 align-top capitalize text-muted-foreground">
                          {c.authMethod ?? "—"}
                        </td>
                        <td className="px-4 py-3.5 align-top">
                          <span
                            className={`inline-block font-medium capitalize ${
                              c.accountStatus === "active"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : c.accountStatus === "suspended"
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {c.accountStatus ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 align-top text-muted-foreground">
                          {formatTableDate(c.createdAt)}
                        </td>
                        <td className="px-4 py-3.5 align-top">
                          <div className="flex w-full min-w-[6.5rem] flex-col gap-1.5">
                            <button
                              type="button"
                              onClick={() => void openView(c)}
                              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/60 px-2.5 py-2 text-xs font-medium text-foreground hover:bg-muted"
                            >
                              <Eye className="h-3.5 w-3.5 shrink-0" />
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate(`/users?view=${encodeURIComponent(c._id)}`)}
                              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-2 text-xs font-medium text-foreground hover:bg-muted"
                            >
                              <UserCircle className="h-3.5 w-3.5 shrink-0" />
                              View as user
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!fullCatalogLoaded && hasMore ? (
                <div className="border-t border-border p-4 text-center">
                  <button
                    type="button"
                    onClick={() => void handleLoadMore()}
                    disabled={loadingMore}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {loadingMore ? "Loading…" : "Load more customers"}
                  </button>
                  {total !== null ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Showing {items.length} of {total} customers
                    </p>
                  ) : null}
                </div>
              ) : fullCatalogLoaded && total !== null ? (
                <div className="border-t border-border px-4 py-2 text-center text-xs text-muted-foreground">
                  All {total} customers loaded
                </div>
              ) : null}
            </>
          )}
        </div>

        {customerDetailVisible && selected ? (
          <section
            ref={customerDetailRef}
            className="mt-8 scroll-mt-20 rounded-2xl border border-border bg-card shadow-sm ring-1 ring-border/40"
            aria-labelledby="customer-detail-heading"
          >
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6 lg:px-8">
              <h2 id="customer-detail-heading" className="text-lg font-semibold tracking-tight text-foreground">
                Customer details
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/users?view=${encodeURIComponent(selected._id)}`)}
                  className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  View as user
                </button>
                <button
                  type="button"
                  onClick={hideDetail}
                  className="rounded-lg border border-primary/35 bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/15"
                >
                  Hide details
                </button>
              </div>
            </header>

            <article className="p-5 sm:p-6 lg:p-8">
              {loadingDetail ? (
                <p className="text-sm text-muted-foreground">Loading details...</p>
              ) : (
                <>
                  <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-muted/40 via-card to-card p-5 sm:p-6 lg:flex lg:items-start lg:justify-between lg:gap-8">
                    <div className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-primary/5 blur-3xl" aria-hidden />
                    <div className="relative min-w-0 flex-1 space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
                          {detail?.name?.trim() ||
                            (detail ? displayEmail(detail) : "") ||
                            "Customer"}
                        </h3>
                        {detail?.highPaying ? <HighPayingTag /> : null}
                      </div>
                      <div
                        className="flex flex-wrap gap-2"
                        aria-label="Customer identifiers"
                      >
                        <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border/80 bg-background/80 px-2.5 py-1 font-mono text-[11px] text-muted-foreground shadow-sm backdrop-blur-sm sm:text-xs">
                          <span className="shrink-0 text-muted-foreground/70">Customer</span>
                          <span className="truncate text-foreground">{detail?.customerId ?? "—"}</span>
                        </span>
                        <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border/80 bg-background/80 px-2.5 py-1 font-mono text-[11px] shadow-sm backdrop-blur-sm sm:text-xs">
                          <span className="shrink-0 text-muted-foreground/70">ID</span>
                          <span className="truncate text-muted-foreground">{detail?._id ?? "—"}</span>
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2.5 shadow-sm">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            Created
                          </p>
                          <p className="mt-0.5 text-xs font-medium text-foreground sm:text-sm">
                            <time dateTime={detail?.createdAt}>{formatIsoDate(detail?.createdAt)}</time>
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2.5 shadow-sm">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            Updated
                          </p>
                          <p className="mt-0.5 text-xs font-medium text-foreground sm:text-sm">
                            <time dateTime={detail?.updatedAt}>{formatIsoDate(detail?.updatedAt)}</time>
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2.5 shadow-sm sm:col-span-1">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            Last login
                          </p>
                          <p className="mt-0.5 text-xs font-medium text-foreground sm:text-sm">
                            <time dateTime={detail?.lastLoginAt}>{formatIsoDate(detail?.lastLoginAt)}</time>
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="relative mt-6 flex shrink-0 justify-center lg:mt-0 lg:justify-end">
                      {detail?.avatar ? (
                        <figure className="overflow-hidden rounded-2xl border-2 border-border bg-muted/30 shadow-lg ring-4 ring-background">
                          <img
                            src={detail.avatar}
                            alt=""
                            className="h-28 w-28 object-cover sm:h-32 sm:w-32"
                          />
                        </figure>
                      ) : (
                        <div
                          className="flex h-28 w-28 items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/20 text-4xl font-semibold text-muted-foreground/40 sm:h-32 sm:w-32"
                          aria-hidden
                        >
                          {(detail?.name?.trim()?.[0] ?? detail?.email?.[0] ?? "?").toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>

                  {detail?.insights ? (
                    <section
                      className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-sm ring-1 ring-border/40 sm:p-5"
                      aria-labelledby="customer-insights-heading"
                    >
                      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                        <h4
                          id="customer-insights-heading"
                          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                        >
                          Spending &amp; order insights
                        </h4>
                        <p className="text-[11px] text-muted-foreground">
                          Spending sums orders except cancelled, refunded, or partially refunded.
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                        <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card p-4 shadow-sm sm:col-span-2 lg:col-span-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Total spending
                          </p>
                          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-foreground sm:text-3xl">
                            {formatMoney(detail.insights.totalSpent, detail.insights.currency)}
                          </p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Across{" "}
                            <span className="font-semibold text-foreground">
                              {detail.insights.revenueOrderCount}
                            </span>{" "}
                            qualifying order
                            {detail.insights.revenueOrderCount === 1 ? "" : "s"}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-muted/10 px-3 py-3 shadow-sm lg:col-span-1">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            All orders
                          </p>
                          <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                            {detail.insights.orderCount}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-muted/10 px-3 py-3 shadow-sm lg:col-span-1">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            Avg order
                          </p>
                          <p className="mt-1 text-lg font-semibold tabular-nums leading-snug text-foreground">
                            {formatMoney(detail.insights.averageOrderValue, detail.insights.currency)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-muted/10 px-3 py-3 shadow-sm lg:col-span-1">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            In progress
                          </p>
                          <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                            {detail.insights.activePipelineCount}
                          </p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">Pending → shipped</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-muted/10 px-3 py-3 shadow-sm sm:col-span-2 lg:col-span-3">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            Last &amp; first order
                          </p>
                          <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                            <div>
                              <p className="text-[10px] text-muted-foreground">Last order</p>
                              <p className="font-medium text-foreground">
                                {detail.insights.lastOrderAt
                                  ? formatIsoDate(detail.insights.lastOrderAt)
                                  : "—"}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">First order</p>
                              <p className="font-medium text-foreground">
                                {detail.insights.firstOrderAt
                                  ? formatIsoDate(detail.insights.firstOrderAt)
                                  : "—"}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-muted/10 px-3 py-3 shadow-sm sm:col-span-2 lg:col-span-3">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            Outcomes
                          </p>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                            <span>
                              <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                                {detail.insights.deliveredCount}
                              </span>{" "}
                              <span className="text-muted-foreground">delivered</span>
                            </span>
                            <span>
                              <span className="font-semibold tabular-nums text-muted-foreground">
                                {detail.insights.cancelledOrRefundedCount}
                              </span>{" "}
                              <span className="text-muted-foreground">cancelled / refunded</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </section>
                  ) : null}

                  <div className="mt-6 grid gap-6 lg:grid-cols-12 lg:gap-8">
                    <div className="space-y-6 lg:col-span-7">
                      <div className="grid gap-6 sm:grid-cols-2">
                        <section
                          className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm ring-1 ring-border/40 sm:p-5"
                          aria-labelledby="customer-account-label"
                        >
                          <h4
                            id="customer-account-label"
                            className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                          >
                            Account
                          </h4>
                          <dl className="grid flex-1 gap-4 text-sm">
                            <div>
                              <dt className="text-xs text-muted-foreground">Status</dt>
                              <dd className="mt-1 font-medium capitalize">{detail?.accountStatus ?? "—"}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-muted-foreground">Auth method</dt>
                              <dd className="mt-1 font-medium">{detail?.authMethod ?? "—"}</dd>
                            </div>
                          </dl>
                        </section>

                        <section
                          className="rounded-2xl border border-border bg-card p-4 shadow-sm ring-1 ring-border/40 sm:p-5"
                          aria-labelledby="customer-contact-label"
                        >
                          <h4
                            id="customer-contact-label"
                            className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                          >
                            Contact
                          </h4>
                          <dl className="space-y-4 text-sm">
                            <div>
                              <dt className="text-xs text-muted-foreground">Email</dt>
                              <dd className="mt-1 break-all font-medium text-foreground">
                                {detail ? displayEmail(detail) : "—"}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs text-muted-foreground">Phone</dt>
                              <dd className="mt-1 font-medium">{detail?.phone ?? "—"}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-muted-foreground">Photo</dt>
                              <dd className="mt-1">
                                {detail?.avatar ? (
                                  <a
                                    href={detail.avatar}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium text-primary underline-offset-2 hover:underline"
                                  >
                                    Open full image
                                  </a>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </dd>
                            </div>
                          </dl>
                        </section>
                      </div>

                      <section
                        className="rounded-2xl border border-border bg-card p-4 shadow-sm ring-1 ring-border/40 sm:p-5"
                        aria-labelledby="customer-orders-label"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h4
                              id="customer-orders-label"
                              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                            >
                              Order history
                            </h4>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {loadingDetail ? (
                                "Loading order summary…"
                              ) : detail?.insights ? (
                                <>
                                  <span className="font-semibold tabular-nums text-foreground">
                                    {detail.insights.orderCount}
                                  </span>{" "}
                                  order{detail.insights.orderCount === 1 ? "" : "s"} linked to this
                                  customer
                                </>
                              ) : (
                                "—"
                              )}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              hideDetail();
                              navigate(
                                `/orders?userId=${encodeURIComponent(detail?.customerId ?? detail?._id ?? "")}`
                              );
                            }}
                            className="inline-flex w-full items-center justify-center rounded-lg border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/15 sm:w-auto"
                          >
                            View in Orders
                          </button>
                        </div>
                      </section>
                    </div>

                    <div className="lg:col-span-5">
                      <section
                        className="sticky top-20 rounded-2xl border border-border bg-card p-4 shadow-sm ring-1 ring-border/40 sm:p-5"
                        aria-labelledby="customer-shipping-label"
                      >
                        <h4
                          id="customer-shipping-label"
                          className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                        >
                          Shipping addresses
                        </h4>
                        {(detail?.shippingAddresses?.length ?? 0) === 0 ? (
                          <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                            No saved addresses
                          </p>
                        ) : (
                          <ul className="grid max-h-[min(70vh,36rem)] gap-3 overflow-y-auto pr-1 text-sm sm:grid-cols-1">
                            {(detail?.shippingAddresses ?? []).map((addr, i) => (
                              <li
                                key={addr._id ?? `${addr.source ?? "addr"}-${i}-${addr.street ?? ""}`}
                                className="rounded-xl border border-border/70 bg-muted/5 p-3.5 shadow-sm transition-colors hover:bg-muted/10"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold text-foreground">
                                    {addr.label?.trim() || "—"}
                                  </span>
                                  {addr.isDefault ? (
                                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                      Default
                                    </span>
                                  ) : null}
                                  {addr.source === "address_book" ? (
                                    <span className="text-[10px] text-muted-foreground">Saved</span>
                                  ) : addr.source === "profile_embedded" ? (
                                    <span className="text-[10px] text-muted-foreground">Legacy</span>
                                  ) : null}
                                </div>
                                <p className="mt-2 leading-relaxed text-muted-foreground">
                                  {[addr.street, addr.city, addr.province ?? addr.state, addr.postalCode]
                                    .filter(Boolean)
                                    .join(", ") || "—"}
                                </p>
                                {addr.deliveryInstructions ? (
                                  <p className="mt-2 border-t border-border/50 pt-2 text-xs text-muted-foreground">
                                    {addr.deliveryInstructions}
                                  </p>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>
                    </div>
                  </div>
                </>
              )}
            </article>
          </section>
        ) : null}
      </div>

      {filtersOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 dark:bg-black/50"
            aria-label="Close filters"
            onClick={() => setFiltersOpen(false)}
          />
          <aside
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-border bg-card shadow-xl"
            aria-labelledby="customers-filters-heading"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 id="customers-filters-heading" className="text-lg font-semibold">
                Customer filters
              </h2>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="rounded-md p-2 hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
              <div>
                <label htmlFor="filter-status" className="mb-1 block text-xs font-medium text-muted-foreground">
                  Account status
                </label>
                <select
                  id="filter-status"
                  value={draftFilters.status}
                  onChange={(e) => setDraftFilters((p) => ({ ...p, status: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="deleted">Deleted</option>
                </select>
              </div>
              <div>
                <label htmlFor="filter-auth" className="mb-1 block text-xs font-medium text-muted-foreground">
                  Auth method
                </label>
                <select
                  id="filter-auth"
                  value={draftFilters.authMethod}
                  onChange={(e) => setDraftFilters((p) => ({ ...p, authMethod: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {AUTH_OPTIONS.map((o) => (
                    <option key={o.value === "" ? "all" : o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-2 border-t border-border p-4 sm:flex-row sm:flex-wrap sm:justify-end">
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={resetDraftFilters}
                className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent"
              >
                Clear draft
              </button>
              <button
                type="button"
                onClick={applySidebarFilters}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Apply filters
              </button>
            </div>
          </aside>
        </>
      )}

      <ScrollTopBottomButtons />
    </AdminLayout>
  );
}

function listQuery(applied: CustomerFilters, paginated: { limit?: number; skip?: number }) {
  const p: Parameters<typeof customersAPI.list>[0] = { ...paginated };
  if (applied.status) p.status = applied.status;
  if (applied.authMethod) p.authMethod = applied.authMethod;
  return p;
}
