import { useEffect, useState } from "react";
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
import { productsAPI, type ProductItem } from "@/lib/api";

type ActionTile = {
  id: string;
  name: string;
  icon: LucideIcon;
  color: string;
  disabled?: boolean;
  action: () => void;
};

function getCategoryName(categoryId: ProductItem["categoryId"]): string {
  if (typeof categoryId === "object" && categoryId !== null && "name" in categoryId) return (categoryId as { name: string }).name;
  return typeof categoryId === "string" ? categoryId : "—";
}

/** Frontend-only: returns a warning if product name suggests a category that doesn't match the selected category. */
function getNameCategoryMismatchWarning(productName: string, categoryName: string): string | null {
  const name = productName.trim().toLowerCase();
  const cat = categoryName.trim().toLowerCase();
  if (!name || !cat) return null;

  const rules: { nameTerms: string[]; categoryTerms: string[]; label: string }[] = [
    { nameTerms: ["pants", "pant"], categoryTerms: ["pant"], label: "Pants" },
    { nameTerms: ["shirt", "shirts"], categoryTerms: ["shirt"], label: "Shirts" },
    { nameTerms: ["watch", "watches"], categoryTerms: ["watch"], label: "Watches" },
    { nameTerms: ["glasses", "goggles", "goggle", "eyewear"], categoryTerms: ["glass", "goggle", "eyewear"], label: "Glasses / Goggles" },
  ];

  for (const { nameTerms, categoryTerms, label } of rules) {
    const nameMatches = nameTerms.some((t) => name.includes(t));
    const categoryMatches = categoryTerms.some((t) => cat.includes(t));
    if (nameMatches && !categoryMatches) {
      return `The product name suggests "${label}" but the selected category is "${categoryName}". Please double-check before saving.`;
    }
  }
  return null;
}

function parseImageUrls(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function validateProductForm(values: {
  name: string;
  description: string;
  categoryId: string;
  basePrice: string;
  mainImageUrl: string;
  imageUrlsRaw: string;
  rating: string;
  reviewCount: string;
}): { valid: boolean; message?: string } {
  if (!values.name.trim()) return { valid: false, message: "Name is required" };
  if (!values.description.trim()) return { valid: false, message: "Description is required" };
  if (!values.categoryId) return { valid: false, message: "Category is required" };
  const price = Number(values.basePrice);
  if (Number.isNaN(price) || price < 0) return { valid: false, message: "Base price must be 0 or greater" };
  if (!values.mainImageUrl.trim()) return { valid: false, message: "Main image URL (primary) is required" };
  const secondaryUrls = parseImageUrls(values.imageUrlsRaw);
  if (secondaryUrls.length !== 3) {
    return { valid: false, message: "Exactly 3 secondary image URLs are required (1 primary + 3 secondary = 4 total)" };
  }
  const rating = Number(values.rating);
  if (!Number.isNaN(rating) && (rating < 0 || rating > 5)) return { valid: false, message: "Rating must be between 0 and 5" };
  const rc = Number(values.reviewCount);
  if (!Number.isNaN(rc) && rc < 0) return { valid: false, message: "Review count cannot be negative" };
  return { valid: true };
}

export default function Products() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selected, setSelected] = useState<ProductItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<"add" | "edit" | "view" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formBasePrice, setFormBasePrice] = useState("");
  const [formMainImageUrl, setFormMainImageUrl] = useState("");
  const [formImageUrls, setFormImageUrls] = useState("");
  const [formFeatures, setFormFeatures] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formIsCustomizable, setFormIsCustomizable] = useState(false);
  const [formRating, setFormRating] = useState("0");
  const [formReviewCount, setFormReviewCount] = useState("0");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestTagsLoading, setSuggestTagsLoading] = useState(false);

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

  const fetchProducts = async () => {
    setLoadingList(true);
    setError(null);
    try {
      const res = await productsAPI.list();
      setProducts(res.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load products");
      setProducts([]);
    } finally {
      setLoadingList(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await categoriesAPI.list();
      setCategories(res.data ?? []);
    } catch {
      setCategories([]);
    }
  };

  useEffect(() => {
    if (user) {
      fetchProducts();
      fetchCategories();
    }
  }, [user]);

  const openAdd = () => {
    setFormName("");
    setFormDescription("");
    setFormCategoryId(categories[0]?.id ?? "");
    setFormBasePrice("");
    setFormMainImageUrl("");
    setFormImageUrls("");
    setFormFeatures("");
    setFormTags("");
    setFormIsCustomizable(false);
    setFormRating("0");
    setFormReviewCount("0");
    setError(null);
    setModal("add");
  };

  const openEdit = () => {
    if (!selected) return;
    setFormName(selected.name);
    setFormDescription(selected.description);
    setFormCategoryId(typeof selected.categoryId === "object" ? (selected.categoryId as { _id: string })._id : selected.categoryId);
    setFormBasePrice(String(selected.basePrice));
    setFormMainImageUrl(selected.mainImageUrl);
    setFormImageUrls((selected.imageUrls ?? []).join("\n"));
    setFormFeatures((selected.features ?? []).join("\n"));
    setFormTags((selected.tags ?? []).join(", "));
    setFormIsCustomizable(selected.isCustomizable ?? false);
    setFormRating(String(selected.rating ?? 0));
    setFormReviewCount(String(selected.reviewCount ?? 0));
    setError(null);
    setModal("edit");
  };

  const openView = () => {
    if (!selected) return;
    setModal("view");
  };

  const openDelete = () => {
    if (selectedIds.size === 0) return;
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

  const parseList = (s: string): string[] =>
    s
      .split(/[\n,]/)
      .map((x) => x.trim())
      .filter(Boolean);

  const handleSuggestDescription = async () => {
    const name = formName.trim() || "this product";
    setSuggestLoading(true);
    setError(null);
    try {
      const categoryName = formCategoryId
        ? categories.find((c) => c.id === formCategoryId)?.name ?? ""
        : "";
      const res = await aiAPI.suggestDescription({
        context: "Product",
        name,
        optionalKeywords: [formTags.trim(), categoryName].filter(Boolean).join(", ") || undefined,
      });
      if (res.data?.suggestion) setFormDescription(res.data.suggestion);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI suggestion failed");
    } finally {
      setSuggestLoading(false);
    }
  };

  const handleSuggestTags = async () => {
    setSuggestTagsLoading(true);
    setError(null);
    try {
      const categoryName = formCategoryId
        ? categories.find((c) => c.id === formCategoryId)?.name ?? ""
        : "";
      const res = await aiAPI.suggestTags({
        name: formName.trim() || undefined,
        description: formDescription.trim() || undefined,
        categoryName: categoryName || undefined,
      });
      if (res.data?.suggestion) setFormTags(res.data.suggestion);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tag suggestion failed");
    } finally {
      setSuggestTagsLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateProductForm({
      name: formName,
      description: formDescription,
      categoryId: formCategoryId,
      basePrice: formBasePrice,
      mainImageUrl: formMainImageUrl,
      imageUrlsRaw: formImageUrls,
      rating: formRating,
      reviewCount: formReviewCount,
    });
    if (!validation.valid) {
      setError(validation.message ?? "Validation failed");
      return;
    }
    setSubmitLoading(true);
    setError(null);
    try {
      await productsAPI.create({
        name: formName.trim(),
        description: formDescription.trim(),
        categoryId: formCategoryId,
        basePrice: Number(formBasePrice),
        mainImageUrl: formMainImageUrl.trim(),
        imageUrls: parseImageUrls(formImageUrls),
        features: parseList(formFeatures),
        tags: parseList(formTags),
        isCustomizable: formIsCustomizable,
        rating: Math.min(5, Math.max(0, Number(formRating) || 0)),
        reviewCount: Math.max(0, Number(formReviewCount) || 0),
      });
      setModal(null);
      fetchProducts();
      fetchCategories();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create product");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const validation = validateProductForm({
      name: formName,
      description: formDescription,
      categoryId: formCategoryId,
      basePrice: formBasePrice,
      mainImageUrl: formMainImageUrl,
      imageUrlsRaw: formImageUrls,
      rating: formRating,
      reviewCount: formReviewCount,
    });
    if (!validation.valid) {
      setError(validation.message ?? "Validation failed");
      return;
    }
    setSubmitLoading(true);
    setError(null);
    try {
      await productsAPI.update(selected.id, {
        name: formName.trim(),
        description: formDescription.trim(),
        categoryId: formCategoryId,
        basePrice: Number(formBasePrice),
        mainImageUrl: formMainImageUrl.trim(),
        imageUrls: parseImageUrls(formImageUrls),
        features: parseList(formFeatures),
        tags: parseList(formTags),
        isCustomizable: formIsCustomizable,
        rating: Math.min(5, Math.max(0, Number(formRating) || 0)),
        reviewCount: Math.max(0, Number(formReviewCount) || 0),
      });
      setModal(null);
      setSelected(null);
      fetchProducts();
      fetchCategories();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update product");
    } finally {
      setSubmitLoading(false);
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
      setSelected(null);
      setSelectedIds(new Set());
      fetchProducts();
      fetchCategories();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete product(s)");
    } finally {
      setSubmitLoading(false);
    }
  };

  const selectedId = selected?.id ?? (selected as { _id?: string } | null)?._id;
  const actionTiles: ActionTile[] = [
    { id: "add", name: "Add", icon: Plus, color: "text-emerald-600 bg-emerald-100", action: openAdd },
    { id: "edit", name: "Edit", icon: Pencil, color: "text-amber-600 bg-amber-100", disabled: !selectedId, action: openEdit },
    { id: "view", name: "View", icon: Eye, color: "text-sky-600 bg-sky-100", disabled: !selectedId, action: openView },
    { id: "delete", name: "Delete", icon: Trash2, color: "text-rose-600 bg-rose-100", disabled: selectedIds.size === 0, action: openDelete },
    { id: "refresh", name: "Refresh", icon: RefreshCw, color: "text-slate-600 bg-slate-100", action: fetchProducts },
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
          <h1 className="text-xl font-serif font-bold">Product</h1>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
          {actionTiles.map(({ id, name, icon: Icon, color, disabled, action }) => (
            <button
              key={id}
              type="button"
              onClick={action}
              disabled={disabled}
              className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${color}`} aria-hidden>
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

        <p className="text-xs text-muted-foreground mb-2">Hold Ctrl (or Cmd) and click rows to select multiple; click Delete to remove selected.</p>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {loadingList ? (
            <div className="p-8 text-center text-muted-foreground">Loading products...</div>
          ) : products.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No products yet. Use Add to create one.</div>
          ) : (
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
                  {products.map((p) => {
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
          )}
        </div>
      </main>

      {/* Add / Edit modal */}
      {(modal === "add" || modal === "edit") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 overflow-y-auto overflow-x-hidden">
          <div className="w-full max-w-lg max-h-[calc(100vh-1.5rem)] min-h-0 flex flex-col rounded-xl bg-card border border-border shadow-xl overflow-hidden my-auto">
            <h2 className="text-lg font-semibold flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-2">{modal === "add" ? "Add product" : "Edit product"}</h2>
            <form onSubmit={modal === "add" ? handleAdd : handleEdit} className="flex flex-col flex-1 min-h-0 min-w-0 px-4 sm:px-6">
              <div className="space-y-4 overflow-y-auto overflow-x-hidden flex-1 min-h-0 pb-4 pr-1">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="text-sm font-medium">Description *</label>
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
                  required
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category *</label>
                <select
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(e.target.value)}
                  required
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {(modal === "add" || modal === "edit") && (() => {
                  const selectedCategory = categories.find((c) => c.id === formCategoryId);
                  const categoryName = selectedCategory?.name ?? "";
                  const mismatchWarning = getNameCategoryMismatchWarning(formName, categoryName);
                  return mismatchWarning ? (
                    <div className="mt-2 rounded-md border border-amber-500/60 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:border-amber-600/50 dark:text-amber-200">
                      {mismatchWarning}
                    </div>
                  ) : null;
                })()}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Base price *</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={formBasePrice}
                    onChange={(e) => setFormBasePrice(e.target.value)}
                    required
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Rating (0–5)</label>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    step="0.1"
                    value={formRating}
                    onChange={(e) => setFormRating(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Primary image URL * (1 of 4)</label>
                <input
                  type="url"
                  value={formMainImageUrl}
                  onChange={(e) => setFormMainImageUrl(e.target.value)}
                  required
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Secondary image URLs * (exactly 3, one per line)</label>
                <textarea
                  value={formImageUrls}
                  onChange={(e) => setFormImageUrls(e.target.value)}
                  rows={3}
                  placeholder="One URL per line (exactly 3 lines)"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="mt-1 text-xs text-muted-foreground">Total: 1 primary + 3 secondary = 4 image URLs.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Features (one per line)</label>
                <textarea
                  value={formFeatures}
                  onChange={(e) => setFormFeatures(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-sm font-medium">Tags (comma separated)</label>
                  <button
                    type="button"
                    onClick={handleSuggestTags}
                    disabled={suggestTagsLoading}
                    className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    {suggestTagsLoading ? "Suggesting…" : "Suggest with AI"}
                  </button>
                </div>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="New, Trending"
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isCustomizable"
                  checked={formIsCustomizable}
                  onChange={(e) => setFormIsCustomizable(e.target.checked)}
                  className="rounded border-input"
                />
                <label htmlFor="isCustomizable" className="text-sm font-medium">
                  Customizable
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Review count</label>
                <input
                  type="number"
                  min={0}
                  value={formReviewCount}
                  onChange={(e) => setFormReviewCount(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              </div>
              <div className="flex gap-2 justify-end pt-3 flex-shrink-0 pb-4 sm:pb-6 border-t border-border mt-2">
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
            className="w-full max-w-lg rounded-xl bg-card border border-border shadow-xl p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-4">View product</h2>
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
                <dt className="text-muted-foreground">Description</dt>
                <dd>{selected.description}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Category</dt>
                <dd>{getCategoryName(selected.categoryId)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Base price</dt>
                <dd>{selected.basePrice}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Rating / Reviews</dt>
                <dd>{selected.rating} / {selected.reviewCount}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Main image</dt>
                <dd className="break-all">{selected.mainImageUrl}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Customizable</dt>
                <dd>{selected.isCustomizable ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Tags</dt>
                <dd>{(selected.tags ?? []).join(", ") || "—"}</dd>
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
      {modal === "delete" && selectedIds.size > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setModal(null)}>
          <div
            className="w-full max-w-sm rounded-xl bg-card border border-border shadow-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-2">Delete product{selectedIds.size > 1 ? "s" : ""}</h2>
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
    </div>
  );
}
