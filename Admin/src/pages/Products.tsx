import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Eye,
  Trash2,
  RefreshCw,
  Sparkles,
  CloudDownload,
  type LucideIcon,
} from "lucide-react";
import { adminAPI, type AdminUser } from "@/lib/api";
import { categoriesAPI, type CategoryItem } from "@/lib/api";
import { productsAPI, type ProductItem } from "@/lib/api";
import { formatIsoDate } from "@/lib/formatIsoDate";
import { useDraggableModal } from "@/hooks/useDraggableModal";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { ProductAiAssistantModal } from "@/components/ProductAiAssistantModal";
import { ScrollTopBottomButtons } from "@/components/ScrollTopBottomButtons";
import { ADMIN_QUERY_STALE_MS } from "@/lib/queryClient";

const PAGE_SIZE = 10;

const adminProductsKey = ["admin", "products"] as const;

type ActionTile = {
  id: string;
  name: string;
  icon: LucideIcon;
  color: string;
  disabled?: boolean;
  action: () => void;
  title?: string;
};

function getCategoryName(categoryId: ProductItem["categoryId"]): string {
  if (typeof categoryId === "object" && categoryId !== null && "name" in categoryId) return (categoryId as { name: string }).name;
  return typeof categoryId === "string" ? categoryId : "—";
}

function getProductId(p: ProductItem): string {
  const raw = p.id ?? (p as { _id?: string })._id;
  return raw != null ? String(raw) : "";
}

function Products() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { dialogStyle, handleProps, reset: resetDrag } = useDraggableModal();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullCatalogLoaded, setFullCatalogLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<ProductItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<"delete" | null>(null);
  const [productDetailVisible, setProductDetailVisible] = useState(false);
  const productDetailRef = useRef<HTMLElement | null>(null);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

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

  const categoriesQuery = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: async () => {
      const res = await categoriesAPI.list();
      return res.data ?? [];
    },
    enabled: Boolean(user),
    staleTime: ADMIN_QUERY_STALE_MS,
  });
  const categories: CategoryItem[] = categoriesQuery.data ?? [];

  const productsInfinite = useInfiniteQuery({
    queryKey: [...adminProductsKey, "paginated"],
    enabled: Boolean(user) && !fullCatalogLoaded,
    initialPageParam: 0,
    staleTime: ADMIN_QUERY_STALE_MS,
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      const res = await productsAPI.list({ limit: PAGE_SIZE, skip: pageParam });
      return res;
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      const loaded = allPages.reduce((sum, p) => sum + (p.data?.length ?? 0), 0);
      return loaded;
    },
  });

  const productsFull = useQuery({
    queryKey: [...adminProductsKey, "full"],
    queryFn: () => productsAPI.list(),
    enabled: Boolean(user) && fullCatalogLoaded,
    staleTime: ADMIN_QUERY_STALE_MS,
  });

  const products = useMemo((): ProductItem[] => {
    if (fullCatalogLoaded && productsFull.data) {
      return productsFull.data.data ?? [];
    }
    return productsInfinite.data?.pages.flatMap((p) => p.data ?? []) ?? [];
  }, [fullCatalogLoaded, productsFull.data, productsInfinite.data]);

  const lastInfinitePage =
    productsInfinite.data?.pages[productsInfinite.data.pages.length - 1];
  const total = fullCatalogLoaded
    ? products.length
    : (lastInfinitePage?.total ?? null);
  const hasMore = fullCatalogLoaded ? false : Boolean(lastInfinitePage?.hasMore);

  const loadingList = fullCatalogLoaded
    ? productsFull.isLoading && !productsFull.data
    : productsInfinite.isLoading && !productsInfinite.data;
  const loadingMore = productsInfinite.isFetchingNextPage;
  const loadingForce = fullCatalogLoaded && productsFull.isFetching;

  const listFetchError =
    (fullCatalogLoaded ? productsFull.error : productsInfinite.error) ??
    null;
  const displayError =
    error ??
    (listFetchError instanceof Error
      ? listFetchError.message
      : listFetchError
        ? String(listFetchError)
        : null);

  const handleLoadMore = () => {
    if (fullCatalogLoaded || !hasMore || loadingMore) return;
    void productsInfinite.fetchNextPage();
  };

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: [...adminProductsKey] });
  };

  const openView = () => {
    if (!selected) return;
    setProductDetailVisible(true);
    requestAnimationFrame(() => {
      productDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const openDelete = () => {
    if (selectedIds.size === 0) return;
    resetDrag();
    setModal("delete");
  };

  const handleRowClick = (e: React.MouseEvent, p: ProductItem) => {
    const id = p.id ?? (p as { _id?: string })._id ?? "";
    if (!id) return;
    if (e.ctrlKey || e.metaKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setSelected(p);
    } else {
      setSelectedIds(new Set([id]));
      setSelected(p);
    }
  };

  const handleDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setSubmitLoading(true);
    setError(null);
    try {
      await Promise.all(ids.map((id) => productsAPI.delete(id)));
      setModal(null);
      setProductDetailVisible(false);
      setSelected(null);
      setSelectedIds(new Set());
      await queryClient.invalidateQueries({ queryKey: [...adminProductsKey] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete product(s)");
    } finally {
      setSubmitLoading(false);
    }
  };

  const selectedId = selected?.id ?? (selected as { _id?: string } | null)?._id;
  const refreshIconSpin = fullCatalogLoaded
    ? productsFull.isFetching
    : Boolean(productsInfinite.isFetching && !productsInfinite.isFetchingNextPage);

  const actionTiles: ActionTile[] = [
    { id: "add", name: "Add", icon: Plus, color: "text-emerald-600 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950/55", action: () => navigate("/products/add") },
    {
      id: "edit",
      name: "Edit",
      icon: Pencil,
      color: "text-amber-600 bg-amber-100 dark:text-amber-300 dark:bg-amber-950/55",
      disabled: !selectedId,
      action: () => {
        if (selectedId) navigate(`/products/edit/${selectedId}`);
      },
    },
    { id: "view", name: "View", icon: Eye, color: "text-sky-600 bg-sky-100 dark:text-sky-300 dark:bg-sky-950/55", disabled: !selectedId, action: openView },
    { id: "delete", name: "Delete", icon: Trash2, color: "text-rose-600 bg-rose-100 dark:text-rose-300 dark:bg-rose-950/55", disabled: selectedIds.size === 0, action: openDelete },
    {
      id: "refresh",
      name: "Refresh",
      icon: RefreshCw,
      color: "text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-800/70",
      action: handleRefresh,
      title: "Fetch latest from database",
    },
    {
      id: "ai-assistant",
      name: "AI Assistant",
      icon: Sparkles,
      color: "text-violet-600 bg-violet-100 dark:text-violet-300 dark:bg-violet-950/55",
      action: () => setAiAssistantOpen(true),
    },
  ];

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      if (p.name.toLowerCase().includes(q)) return true;
      return getCategoryName(p.categoryId).toLowerCase().includes(q);
    });
  }, [products, searchQuery]);

  const showSearchNoMatches =
    searchQuery.trim().length > 0 && filteredProducts.length === 0 && products.length > 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <AdminLayout title="Products" userEmail={user?.email}>
      <div className="mx-auto max-w-6xl">
        <div className="sticky top-14 z-20 -mx-4 mb-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
            <div className="flex shrink-0 flex-wrap items-center gap-1 sm:flex-nowrap">
              {actionTiles.map(({ id, name, icon: Icon, color, disabled, action, title: tileTitle }) => (
                <button
                  key={id}
                  type="button"
                  onClick={action}
                  disabled={disabled}
                  title={tileTitle ?? name}
                  aria-label={tileTitle ?? name}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${color}`}
                >
                  <Icon
                    className={`h-4 w-4 ${id === "refresh" && refreshIconSpin ? "animate-spin" : ""}`}
                    aria-hidden
                  />
                </button>
              ))}
            </div>
            <div className="min-w-0 flex-1 basis-[min(100%,12rem)] sm:basis-64">
              <label htmlFor="product-search" className="sr-only">
                Search loaded products
              </label>
              <input
                id="product-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by name or category…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                autoComplete="off"
              />
            </div>
            <button
              type="button"
              onClick={() => setFullCatalogLoaded(true)}
              disabled={loadingForce || loadingList}
              title="Force load all products from database (may take longer on large catalogs)"
              aria-label={loadingForce ? "Loading all products" : "Force load all products from database"}
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
          Force load fetches every product at once and may take longer on large catalogs.
        </p>

        {displayError && (
          <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
            {displayError}
          </div>
        )}

        {showSearchNoMatches && (
          <div className="mb-4 rounded-md border border-amber-500/50 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            No match in the products currently loaded. Try &quot;Load more products&quot; — the product you want may appear after loading more.
          </div>
        )}

        <p className="text-xs text-muted-foreground mb-2">Hold Ctrl (or Cmd) and click rows to select multiple; click Delete to remove selected.</p>
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          {loadingList ? (
            <div className="p-8 text-center text-muted-foreground">Loading products...</div>
          ) : products.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No products yet. Use Add to create one.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-muted/50">
                    <tr>
                      <th className="p-3 font-medium">Name</th>
                      <th className="p-3 font-medium">Category</th>
                      <th className="p-3 font-medium">Price</th>
                      <th className="p-3 font-medium">Rating</th>
                      <th className="p-3 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((p) => {
                      const id = p.id ?? (p as { _id?: string })._id ?? "";
                      const isSelected = selectedIds.has(id);
                      return (
                        <tr
                          key={id}
                          onClick={(e) => handleRowClick(e, p)}
                          className={`border-b border-border last:border-0 cursor-pointer transition-colors select-none ${
                            isSelected ? "bg-primary/15 ring-1 ring-primary/30" : "hover:bg-muted/30"
                          }`}
                        >
                          <td className="p-3 font-medium">{p.name}</td>
                          <td className="p-3 text-muted-foreground">{getCategoryName(p.categoryId)}</td>
                          <td className="p-3">{p.basePrice}</td>
                          <td className="p-3">{p.rating}</td>
                          <td className="p-3 text-muted-foreground">
                            {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}
                          </td>
                        </tr>
                      );
                    })}
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
                    {loadingMore ? "Loading…" : "Load more products"}
                  </button>
                  {total !== null ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Showing {products.length} of {total} products
                    </p>
                  ) : null}
                </div>
              ) : fullCatalogLoaded && total !== null ? (
                <div className="border-t border-border px-4 py-2 text-center text-xs text-muted-foreground">
                  All {total} products loaded
                </div>
              ) : null}
            </>
          )}
        </div>

        {productDetailVisible && selected ? (
          <section
            ref={productDetailRef}
            className="mt-8 scroll-mt-20 rounded-2xl border border-border bg-card shadow-sm"
            aria-labelledby="product-detail-heading"
          >
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
              <h2 id="product-detail-heading" className="text-lg font-semibold tracking-tight text-foreground">
                Product details
              </h2>
              <button
                type="button"
                onClick={() => setProductDetailVisible(false)}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
              >
                Hide details
              </button>
            </header>

            <article className="p-5 sm:p-6">
              <div className="grid gap-8 lg:grid-cols-12 lg:gap-8 lg:items-start">
                <div className="space-y-5 lg:col-span-7">
                  <header className="space-y-3">
                    <h3 className="text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">{selected.name}</h3>
                    <div
                      className="flex flex-wrap gap-x-4 gap-y-1 border-l-2 border-muted pl-3 text-xs text-muted-foreground"
                      aria-label="Product identifiers and timestamps"
                    >
                      <span className="break-all font-mono">
                        <span className="text-muted-foreground/80">ID </span>
                        {getProductId(selected) || "—"}
                      </span>
                      <span className="break-all font-mono">
                        <span className="text-muted-foreground/80">Slug </span>
                        {selected.slug}
                      </span>
                      <span>
                        <span className="text-muted-foreground/80">Created </span>
                        <time dateTime={selected.createdAt}>{formatIsoDate(selected.createdAt)}</time>
                      </span>
                      <span>
                        <span className="text-muted-foreground/80">Updated </span>
                        <time dateTime={selected.updatedAt}>{formatIsoDate(selected.updatedAt)}</time>
                      </span>
                    </div>
                  </header>

                  <section
                    className="rounded-xl border border-border bg-muted/10 p-4 sm:p-5"
                    aria-labelledby="product-category-label"
                  >
                    <h4 id="product-category-label" className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Category
                    </h4>
                    <div className="text-sm text-foreground">
                      {typeof selected.categoryId === "object" && selected.categoryId !== null && "name" in selected.categoryId ? (
                        <div className="space-y-2">
                          <p className="text-base font-medium">{(selected.categoryId as { name: string }).name}</p>
                          <p className="text-xs text-muted-foreground">
                            Slug <span className="font-mono">{(selected.categoryId as { slug?: string }).slug ?? "—"}</span>
                          </p>
                          <p className="break-all text-xs text-muted-foreground font-mono">
                            Category id {String((selected.categoryId as { _id?: unknown })._id ?? "—")}
                          </p>
                        </div>
                      ) : (
                        <p>{String(selected.categoryId ?? "—")}</p>
                      )}
                    </div>
                  </section>

                  <section
                    className="rounded-xl border border-border bg-muted/10 p-4 sm:p-5"
                    aria-labelledby="product-pricing-label"
                  >
                    <h4 id="product-pricing-label" className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Pricing &amp; reviews
                    </h4>
                    <dl className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <dt className="text-xs text-muted-foreground">Base price</dt>
                        <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">{selected.basePrice}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Rating</dt>
                        <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">{selected.rating}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Review count</dt>
                        <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">{selected.reviewCount}</dd>
                      </div>
                    </dl>
                  </section>

                  <section
                    className="rounded-xl border border-border bg-muted/10 p-4 sm:p-5"
                    aria-labelledby="product-inventory-label"
                  >
                    <h4 id="product-inventory-label" className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Inventory &amp; settings
                    </h4>
                    <dl className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <dt className="text-xs text-muted-foreground">Stock quantity</dt>
                        <dd className="mt-1 text-sm font-medium tabular-nums text-foreground">{selected.stockQuantity ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Low stock threshold</dt>
                        <dd className="mt-1 text-sm font-medium tabular-nums text-foreground">{selected.lowStockThreshold ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Customizable</dt>
                        <dd className="mt-1 text-sm font-medium text-foreground">{selected.isCustomizable ? "Yes" : "No"}</dd>
                      </div>
                    </dl>
                  </section>

                  <section aria-labelledby="product-description-label">
                    <h4 id="product-description-label" className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Description
                    </h4>
                    <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-background/80 px-4 py-3 text-sm leading-relaxed text-foreground shadow-inner">
                      <p className="whitespace-pre-wrap">{selected.description}</p>
                    </div>
                  </section>

                  <section
                    className="rounded-xl border border-border bg-muted/10 p-4 sm:p-5"
                    aria-labelledby="product-features-label"
                  >
                    <h4 id="product-features-label" className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Features
                    </h4>
                    {(selected.features ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">None</p>
                    ) : (
                      <ul className="max-h-52 space-y-2 overflow-y-auto border border-border/60 rounded-md bg-background/60 px-4 py-3 text-sm leading-relaxed">
                        {(selected.features ?? []).map((f, i) => (
                          <li key={`${f}-${i}`} className="border-b border-border/40 pb-2 last:border-0 last:pb-0">
                            {f}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section
                    className="rounded-xl border border-border bg-muted/10 p-4 sm:p-5"
                    aria-labelledby="product-tags-label"
                  >
                    <h4 id="product-tags-label" className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Tags
                    </h4>
                    {(selected.tags ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">None</p>
                    ) : (
                      <ul className="flex flex-wrap gap-2">
                        {(selected.tags ?? []).map((t, i) => (
                          <li key={`${t}-${i}`}>
                            <span className="inline-flex rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium text-foreground">
                              {t}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>

                <div className="space-y-5 lg:col-span-5 lg:sticky lg:top-24">
                  <section aria-labelledby="product-primary-image-label">
                    <h4 id="product-primary-image-label" className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Primary image
                    </h4>
                    <figure className="overflow-hidden rounded-xl border border-border bg-muted/20 shadow-sm">
                      {selected.mainImageUrl ? (
                        <img
                          src={selected.mainImageUrl}
                          alt=""
                          className="aspect-[4/3] w-full object-contain bg-background"
                        />
                      ) : (
                        <figcaption className="flex aspect-[4/3] items-center justify-center p-6 text-sm text-muted-foreground">
                          No primary image URL
                        </figcaption>
                      )}
                      {selected.mainImageUrl ? (
                        <figcaption className="border-t border-border bg-muted/30 px-3 py-2 text-[11px] leading-snug break-all text-muted-foreground font-mono">
                          {selected.mainImageUrl}
                        </figcaption>
                      ) : null}
                    </figure>
                  </section>

                  <section aria-labelledby="product-more-images-label">
                    <h4 id="product-more-images-label" className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Gallery
                    </h4>
                    {(selected.imageUrls ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">None</p>
                    ) : (
                      <ol className="flex flex-wrap gap-2">
                        {(selected.imageUrls ?? []).map((url, i) => (
                          <li key={`${url}-${i}`} className="shrink-0">
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block overflow-hidden rounded-lg border border-border bg-background shadow-sm ring-offset-background transition hover:ring-2 hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              title={url}
                            >
                              <img src={url} alt="" className="h-20 w-20 object-cover sm:h-24 sm:w-24" />
                            </a>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>

                  <section
                    className="rounded-xl border border-border bg-muted/10 p-4 sm:p-5"
                    aria-labelledby="product-image-urls-label"
                  >
                    <h4 id="product-image-urls-label" className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Image URLs
                    </h4>
                    <dl className="space-y-4 text-sm">
                      <div>
                        <dt className="text-xs font-medium text-muted-foreground">Primary</dt>
                        <dd className="mt-1.5">
                          {selected.mainImageUrl ? (
                            <a
                              href={selected.mainImageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="break-all font-mono text-xs text-primary underline-offset-2 hover:underline"
                            >
                              {selected.mainImageUrl}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-muted-foreground">Secondary</dt>
                        <dd className="mt-1.5">
                          {(selected.imageUrls ?? []).length === 0 ? (
                            <span className="text-muted-foreground">None</span>
                          ) : (
                            <ol className="list-decimal space-y-2 pl-4 marker:text-muted-foreground">
                              {(selected.imageUrls ?? []).map((url, i) => (
                                <li key={`url-list-${url}-${i}`} className="pl-1">
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="break-all font-mono text-xs text-primary underline-offset-2 hover:underline"
                                  >
                                    {url}
                                  </a>
                                </li>
                              ))}
                            </ol>
                          )}
                        </dd>
                      </div>
                    </dl>
                  </section>
                </div>
              </div>
            </article>
          </section>
        ) : null}
      </div>

      <ScrollTopBottomButtons />

      <ProductAiAssistantModal
        open={aiAssistantOpen}
        onClose={() => setAiAssistantOpen(false)}
        categories={categories}
        onCompleted={() => {
          void queryClient.invalidateQueries({ queryKey: [...adminProductsKey] });
          void queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
        }}
      />

      {modal === "delete" && selectedIds.size > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/60" onClick={() => setModal(null)}>
          <div
            className="w-full max-w-sm rounded-xl bg-card border border-border shadow-xl p-6"
            style={dialogStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 {...handleProps} className="text-lg font-semibold mb-2 cursor-grab active:cursor-grabbing select-none touch-none">
              Delete product{selectedIds.size > 1 ? "s" : ""}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {selectedIds.size === 1 && selected
                ? <>Delete &quot;{selected.name}&quot;? This cannot be undone.</>
                : <>Delete {selectedIds.size} selected products? This cannot be undone.</>
              }
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-md px-4 py-2 text-sm font-medium border border-input hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={submitLoading}
                className="rounded-md px-4 py-2 text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {submitLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default Products;
