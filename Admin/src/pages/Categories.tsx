import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Eye,
  Trash2,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { adminAPI, aiAPI, type AdminUser } from "@/lib/api";
import { categoriesAPI, type CategoryItem } from "@/lib/api";

type ActionTile = {
  id: string;
  name: string;
  icon: LucideIcon;
  color: string;
  disabled?: boolean;
  action: () => void;
};

export default function Categories() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selected, setSelected] = useState<CategoryItem | null>(null);
  const [modal, setModal] = useState<"add" | "edit" | "view" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; startOffsetX: number; startOffsetY: number } | null>(null);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const start = dragStartRef.current;
      if (!start) return;
      setDragOffset({
        x: start.startOffsetX + (e.clientX - start.startX),
        y: start.startOffsetY + (e.clientY - start.startY),
      });
    };
    const onTouchMove = (e: TouchEvent) => {
      const start = dragStartRef.current;
      if (!start || !e.touches[0]) return;
      setDragOffset({
        x: start.startOffsetX + (e.touches[0].clientX - start.startX),
        y: start.startOffsetY + (e.touches[0].clientY - start.startY),
      });
    };
    const onUp = () => {
      dragStartRef.current = null;
      setIsDragging(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [isDragging]);

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

  const fetchCategories = async () => {
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
  };

  useEffect(() => {
    if (user) fetchCategories();
  }, [user]);

  const openAdd = () => {
    setFormName("");
    setFormImageUrl("");
    setFormDescription("");
    setDragOffset({ x: 0, y: 0 });
    setModal("add");
  };

  const openEdit = () => {
    if (!selected) return;
    setFormName(selected.name);
    setFormImageUrl(selected.imageUrl);
    setFormDescription(selected.description ?? "");
    setDragOffset({ x: 0, y: 0 });
    setModal("edit");
  };

  const openView = () => {
    if (!selected) return;
    setModal("view");
  };

  const openDelete = () => {
    if (!selected) return;
    setModal("delete");
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setError(null);
    try {
      await categoriesAPI.create({
        name: formName.trim(),
        imageUrl: formImageUrl.trim(),
        description: formDescription.trim() || undefined,
      });
      setModal(null);
      fetchCategories();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create category");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSubmitLoading(true);
    setError(null);
    try {
      await categoriesAPI.update(selected.id, {
        name: formName.trim(),
        imageUrl: formImageUrl.trim(),
        description: formDescription.trim() || undefined,
      });
      setModal(null);
      setSelected(null);
      fetchCategories();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update category");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSubmitLoading(true);
    setError(null);
    try {
      await categoriesAPI.delete(selected.id);
      setModal(null);
      setSelected(null);
      fetchCategories();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete category");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleSuggestDescription = async () => {
    const name = formName.trim() || "this category";
    setSuggestLoading(true);
    setError(null);
    try {
      const res = await aiAPI.suggestDescription({
        context: "Category",
        name,
      });
      if (res.data?.suggestion) setFormDescription(res.data.suggestion);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get suggestion");
    } finally {
      setSuggestLoading(false);
    }
  };

  const selectedId = selected?.id;
  const actionTiles: ActionTile[] = [
    { id: "add", name: "Add", icon: Plus, color: "text-emerald-600 bg-emerald-100", action: openAdd },
    {
      id: "edit",
      name: "Edit",
      icon: Pencil,
      color: "text-amber-600 bg-amber-100",
      disabled: !selectedId,
      action: openEdit,
    },
    {
      id: "view",
      name: "View",
      icon: Eye,
      color: "text-sky-600 bg-sky-100",
      disabled: !selectedId,
      action: openView,
    },
    {
      id: "delete",
      name: "Delete",
      icon: Trash2,
      color: "text-rose-600 bg-rose-100",
      disabled: !selectedId,
      action: openDelete,
    },
    { id: "refresh", name: "Refresh", icon: RefreshCw, color: "text-slate-600 bg-slate-100", action: fetchCategories },
  ];

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
            Dashboard
          </button>
          <h1 className="text-xl font-serif font-bold">Category</h1>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <button
              type="button"
              onClick={async () => {
                try {
                  await adminAPI.logout();
                } finally {
                  navigate("/login", { replace: true });
                }
              }}
              className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Odoo-style action buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
          {actionTiles.map(({ id, name, icon: Icon, color, disabled, action }) => (
            <button
              key={id}
              type="button"
              onClick={action}
              disabled={disabled}
              className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${color}`}
                aria-hidden
              >
                <Icon className="h-6 w-6" />
              </span>
              <span className="text-sm font-medium text-foreground">{name}</span>
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* List */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {loadingList ? (
            <div className="p-8 text-center text-muted-foreground">Loading categories...</div>
          ) : categories.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No categories yet. Use Add to create one.</div>
          ) : (
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
                {categories.map((cat) => (
                  <tr
                    key={cat.id}
                    onClick={() => setSelected(cat)}
                    className={`border-b border-border last:border-0 cursor-pointer transition-colors ${
                      selectedId === cat.id ? "bg-primary/10" : "hover:bg-muted/30"
                    }`}
                  >
                    <td className="p-3 font-medium">{cat.name}</td>
                    <td className="p-3 text-muted-foreground">{cat.slug}</td>
                    <td className="p-3">{cat.productCount}</td>
                    <td className="p-3 text-muted-foreground">
                      {cat.createdAt ? new Date(cat.createdAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Add / Edit modal - closes only on Cancel button, draggable by title bar */}
      {(modal === "add" || modal === "edit") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div
            className="w-full max-w-md rounded-xl bg-card border border-border shadow-xl overflow-hidden"
            style={{ transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }}
          >
            <div
              role="button"
              tabIndex={0}
              onMouseDown={(e) => {
                if (e.button !== 0) return;
                dragStartRef.current = {
                  startX: e.clientX,
                  startY: e.clientY,
                  startOffsetX: dragOffset.x,
                  startOffsetY: dragOffset.y,
                };
                setIsDragging(true);
              }}
              onTouchStart={(e) => {
                const t = e.touches[0];
                if (!t) return;
                dragStartRef.current = {
                  startX: t.clientX,
                  startY: t.clientY,
                  startOffsetX: dragOffset.x,
                  startOffsetY: dragOffset.y,
                };
                setIsDragging(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") e.preventDefault();
              }}
              className="cursor-grab active:cursor-grabbing px-6 py-4 border-b border-border bg-muted/30 select-none touch-none"
              aria-label="Drag to move dialog"
            >
              <h2 className="text-lg font-semibold">{modal === "add" ? "Add category" : "Edit category"}</h2>
            </div>
            <form onSubmit={modal === "add" ? handleAdd : handleEdit} className="space-y-4 p-6">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Image URL</label>
                <input
                  type="url"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  required
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-sm font-medium">Description (optional)</label>
                  <button
                    type="button"
                    onClick={handleSuggestDescription}
                    disabled={suggestLoading}
                    className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                  >
                    {suggestLoading ? "Suggesting…" : "Suggest with AI"}
                  </button>
                </div>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="rounded-md px-4 py-2 text-sm font-medium border border-input hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="rounded-md px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitLoading ? "Saving..." : modal === "add" ? "Create" : "Update"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View modal */}
      {modal === "view" && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setModal(null)}>
          <div
            className="w-full max-w-md rounded-xl bg-card border border-border shadow-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-4">View category</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-medium">{selected.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Slug</dt>
                <dd>{selected.slug}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Image URL</dt>
                <dd className="break-all">{selected.imageUrl}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Description</dt>
                <dd>{selected.description || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Product count</dt>
                <dd>{selected.productCount}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd>{selected.createdAt ? new Date(selected.createdAt).toLocaleString() : "—"}</dd>
              </div>
            </dl>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-md px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {modal === "delete" && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setModal(null)}>
          <div
            className="w-full max-w-sm rounded-xl bg-card border border-border shadow-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-2">Delete category</h2>
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
    </div>
  );
}
