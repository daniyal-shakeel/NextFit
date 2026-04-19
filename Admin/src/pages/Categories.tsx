import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Pencil,
  Eye,
  Trash2,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { adminAPI, type AdminUser } from "@/lib/api";
import { categoriesAPI, type CategoryItem } from "@/lib/api";
import { formatIsoDate } from "@/lib/formatIsoDate";
import { useDraggableModal } from "@/hooks/useDraggableModal";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { CategoryEditorForm } from "@/components/CategoryEditorForm";
import { ScrollTopBottomButtons } from "@/components/ScrollTopBottomButtons";

type ActionTile = {
  id: string;
  name: string;
  icon: LucideIcon;
  color: string;
  disabled?: boolean;
  action: () => void;
};

function getCategoryId(c: CategoryItem): string {
  return c.id ?? (c as { _id?: string })._id ?? "";
}

export default function Categories() {
  const navigate = useNavigate();
  const { dialogStyle, handleProps, reset: resetDrag } = useDraggableModal();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<CategoryItem | null>(null);
  const [modal, setModal] = useState<"add" | "delete" | null>(null);
  const [addFormKey, setAddFormKey] = useState(0);
  const [categoryDetailVisible, setCategoryDetailVisible] = useState(false);
  const categoryDetailRef = useRef<HTMLElement | null>(null);
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

  const fetchCategories = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const res = await categoriesAPI.list();
      setCategories(res.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load categories");
      setCategories([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (user) void fetchCategories();
  }, [user, fetchCategories]);

  const openAdd = () => {
    setAddFormKey((k) => k + 1);
    resetDrag();
    setModal("add");
  };

  const openView = () => {
    if (!selected) return;
    setCategoryDetailVisible(true);
    requestAnimationFrame(() => {
      categoryDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const openDelete = () => {
    if (!selected) return;
    resetDrag();
    setModal("delete");
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSubmitLoading(true);
    setError(null);
    try {
      await categoriesAPI.delete(selected.id);
      setModal(null);
      setCategoryDetailVisible(false);
      setSelected(null);
      await fetchCategories();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete category");
    } finally {
      setSubmitLoading(false);
    }
  };

  const selectedId = selected ? getCategoryId(selected) : undefined;

  const actionTiles: ActionTile[] = [
    { id: "add", name: "Add", icon: Plus, color: "text-emerald-600 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950/55", action: openAdd },
    {
      id: "edit",
      name: "Edit",
      icon: Pencil,
      color: "text-amber-600 bg-amber-100 dark:text-amber-300 dark:bg-amber-950/55",
      disabled: !selectedId,
      action: () => {
        if (selectedId) navigate(`/categories/edit/${selectedId}`);
      },
    },
    {
      id: "view",
      name: "View",
      icon: Eye,
      color: "text-sky-600 bg-sky-100 dark:text-sky-300 dark:bg-sky-950/55",
      disabled: !selectedId,
      action: openView,
    },
    {
      id: "delete",
      name: "Delete",
      icon: Trash2,
      color: "text-rose-600 bg-rose-100 dark:text-rose-300 dark:bg-rose-950/55",
      disabled: !selectedId,
      action: openDelete,
    },
    { id: "refresh", name: "Refresh", icon: RefreshCw, color: "text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-800/70", action: () => void fetchCategories() },
  ];

  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true;
      if (c.slug.toLowerCase().includes(q)) return true;
      if ((c.description ?? "").toLowerCase().includes(q)) return true;
      return false;
    });
  }, [categories, searchQuery]);

  const showSearchNoMatches =
    searchQuery.trim().length > 0 && filteredCategories.length === 0 && categories.length > 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <AdminLayout title="Categories" userEmail={user?.email}>
      <div className="mx-auto max-w-6xl">
        <div className="sticky top-14 z-20 -mx-4 mb-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
            <div className="flex shrink-0 flex-wrap items-center gap-1 sm:flex-nowrap">
              {actionTiles.map(({ id, name, icon: Icon, color, disabled, action }) => (
                <button
                  key={id}
                  type="button"
                  onClick={action}
                  disabled={disabled}
                  title={name}
                  aria-label={name}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${color}`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </button>
              ))}
            </div>
            <div className="min-w-0 flex-1 basis-[min(100%,12rem)] sm:basis-64">
              <label htmlFor="category-search" className="sr-only">
                Search categories
              </label>
              <input
                id="category-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by name, slug, or description…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                autoComplete="off"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {showSearchNoMatches && (
          <div className="mb-4 rounded-md border border-amber-500/50 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            No categories match your filter. Try a different search term.
          </div>
        )}

        <p className="text-xs text-muted-foreground mb-2">Click a row to select it, then use View, Edit, or Delete.</p>

        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          {loadingList ? (
            <div className="p-8 text-center text-muted-foreground">Loading categories...</div>
          ) : categories.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No categories yet. Use Add to create one.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="p-3 font-medium">Name</th>
                    <th className="p-3 font-medium">Slug</th>
                    <th className="p-3 font-medium">Products</th>
                    <th className="p-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.map((cat) => {
                    const id = getCategoryId(cat);
                    const isSelected = selectedId === id;
                    return (
                      <tr
                        key={id}
                        onClick={() => setSelected(cat)}
                        className={`border-b border-border last:border-0 cursor-pointer transition-colors select-none ${
                          isSelected ? "bg-primary/15 ring-1 ring-primary/30" : "hover:bg-muted/30"
                        }`}
                      >
                        <td className="p-3 font-medium">{cat.name}</td>
                        <td className="p-3 text-muted-foreground">{cat.slug}</td>
                        <td className="p-3">{cat.productCount}</td>
                        <td className="p-3 text-muted-foreground">
                          {cat.createdAt ? new Date(cat.createdAt).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {categoryDetailVisible && selected ? (
          <section
            ref={categoryDetailRef}
            className="mt-8 scroll-mt-20 rounded-2xl border border-border bg-card shadow-sm"
            aria-labelledby="category-detail-heading"
          >
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
              <h2 id="category-detail-heading" className="text-lg font-semibold tracking-tight text-foreground">
                Category details
              </h2>
              <button
                type="button"
                onClick={() => setCategoryDetailVisible(false)}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
              >
                Hide details
              </button>
            </header>

            <article className="p-5 sm:p-6">
              <div className="grid gap-8 lg:grid-cols-12 lg:gap-8 lg:items-start">
                <div className="space-y-5 lg:col-span-7">
                  <header className="space-y-3">
                    <h3 className="text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
                      {selected.name}
                    </h3>
                    <div
                      className="flex flex-wrap gap-x-4 gap-y-1 border-l-2 border-muted pl-3 text-xs text-muted-foreground"
                      aria-label="Category identifiers and timestamps"
                    >
                      <span className="break-all font-mono">
                        <span className="text-muted-foreground/80">ID </span>
                        {getCategoryId(selected) || "—"}
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
                    aria-labelledby="category-stats-label"
                  >
                    <h4 id="category-stats-label" className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Catalog
                    </h4>
                    <dl className="grid gap-4 sm:grid-cols-1">
                      <div>
                        <dt className="text-xs text-muted-foreground">Products in category</dt>
                        <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">{selected.productCount}</dd>
                      </div>
                    </dl>
                  </section>

                  <section aria-labelledby="category-description-label">
                    <h4 id="category-description-label" className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Description
                    </h4>
                    <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-background/80 px-4 py-3 text-sm leading-relaxed text-foreground shadow-inner">
                      <p className="whitespace-pre-wrap">{selected.description?.trim() ? selected.description : "—"}</p>
                    </div>
                  </section>

                  <section
                    className="rounded-xl border border-border bg-muted/10 p-4 sm:p-5"
                    aria-labelledby="category-image-url-label"
                  >
                    <h4 id="category-image-url-label" className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Image URL
                    </h4>
                    {selected.imageUrl ? (
                      <a
                        href={selected.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all font-mono text-xs text-primary underline-offset-2 hover:underline"
                      >
                        {selected.imageUrl}
                      </a>
                    ) : (
                      <p className="text-sm text-muted-foreground">—</p>
                    )}
                  </section>
                </div>

                <div className="space-y-5 lg:col-span-5 lg:sticky lg:top-24">
                  <section aria-labelledby="category-image-label">
                    <h4 id="category-image-label" className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Image
                    </h4>
                    <figure className="overflow-hidden rounded-xl border border-border bg-muted/20 shadow-sm">
                      {selected.imageUrl ? (
                        <img src={selected.imageUrl} alt="" className="aspect-square w-full object-cover bg-background" />
                      ) : (
                        <figcaption className="flex aspect-square items-center justify-center p-6 text-sm text-muted-foreground">
                          No image URL
                        </figcaption>
                      )}
                    </figure>
                  </section>
                </div>
              </div>
            </article>
          </section>
        ) : null}
      </div>

      <ScrollTopBottomButtons />

      {modal === "add" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/60">
          <div
            className="w-full max-w-md rounded-xl bg-card border border-border shadow-xl overflow-hidden"
            style={dialogStyle}
          >
            <div
              {...handleProps}
              className="cursor-grab active:cursor-grabbing px-6 py-4 border-b border-border bg-muted/30 select-none touch-none"
            >
              <h2 className="text-lg font-semibold">Add category</h2>
            </div>
            <div className="p-6 pt-4">
              <CategoryEditorForm
                key={addFormKey}
                initialValues={{ name: "", imageUrl: "", description: "" }}
                submitLabel="Create"
                listenPaste
                onCancel={() => setModal(null)}
                onSubmit={async (body) => {
                  setError(null);
                  try {
                    await categoriesAPI.create(body);
                    setModal(null);
                    await fetchCategories();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Failed to create category");
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {modal === "delete" && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/60" onClick={() => setModal(null)}>
          <div
            className="w-full max-w-sm rounded-xl bg-card border border-border shadow-xl p-6"
            style={dialogStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 {...handleProps} className="text-lg font-semibold mb-2 cursor-grab active:cursor-grabbing select-none touch-none">
              Delete category
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Delete &quot;{selected.name}&quot;? This cannot be undone.
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
                onClick={() => void handleDelete()}
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
