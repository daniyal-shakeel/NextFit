import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Upload } from "lucide-react";
import { adminAPI, aiAPI, type AdminUser } from "@/lib/api";
import { categoriesAPI, type CategoryItem } from "@/lib/api";
import { productsAPI } from "@/lib/api";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { resizeImageTo800Square } from "@/lib/resizeProductImage";

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

function parseList(s: string): string[] {
  return s
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

type PasteTarget = "primary" | 0 | 1 | 2;

type ImageSlot = {
  manualUrl: string;
  cloudUrl: string | null;
  uploading: boolean;
  error: string | null;
  preview: string;
};

function emptySlot(): ImageSlot {
  return { manualUrl: "", cloudUrl: null, uploading: false, error: null, preview: "" };
}

export default function AddProduct() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestTagsLoading, setSuggestTagsLoading] = useState(false);
  const [suggestFeaturesLoading, setSuggestFeaturesLoading] = useState(false);

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formBasePrice, setFormBasePrice] = useState("");
  const [formRating, setFormRating] = useState("0");
  const [formFeatures, setFormFeatures] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formReviewCount, setFormReviewCount] = useState("0");

  const [primary, setPrimary] = useState<ImageSlot>(() => emptySlot());
  const [secondary, setSecondary] = useState<ImageSlot[]>(() => [emptySlot(), emptySlot(), emptySlot()]);
  const pasteTargetRef = useRef<PasteTarget>("primary");

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

  useEffect(() => {
    categoriesAPI
      .list()
      .then((res) => {
        const list = res.data ?? [];
        setCategories(list);
        setFormCategoryId((id) => id || list[0]?.id || "");
      })
      .catch(() => setCategories([]));
  }, []);

  const setPrimarySlot = (fn: (p: ImageSlot) => ImageSlot) => {
    setPrimary((p) => fn(p));
  };

  const setSecondarySlot = (index: number, fn: (s: ImageSlot) => ImageSlot) => {
    setSecondary((prev) => prev.map((s, i) => (i === index ? fn(s) : s)));
  };

  const processFileForSlot = async (
    file: File | null,
    which: "primary" | number
  ) => {
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      const msg = "Invalid file type. Use JPG, PNG, or WebP.";
      if (which === "primary") setPrimarySlot((s) => ({ ...s, error: msg }));
      else setSecondarySlot(which as number, (s) => ({ ...s, error: msg }));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      const msg = "Image must be 2MB or smaller.";
      if (which === "primary") setPrimarySlot((s) => ({ ...s, error: msg }));
      else setSecondarySlot(which as number, (s) => ({ ...s, error: msg }));
      return;
    }

    const applySlot = (slot: ImageSlot): ImageSlot => {
      if (slot.preview) URL.revokeObjectURL(slot.preview);
      return { ...slot, error: null, cloudUrl: null, uploading: true };
    };

    if (which === "primary") {
      setPrimarySlot(applySlot);
    } else {
      setSecondarySlot(which, applySlot);
    }

    try {
      const resized = await resizeImageTo800Square(file);
      const preview = URL.createObjectURL(resized);
      if (which === "primary") {
        setPrimary((s) => {
          if (s.preview) URL.revokeObjectURL(s.preview);
          return { ...s, preview, uploading: true, error: null };
        });
      } else {
        setSecondary((prev) =>
          prev.map((s, i) => {
            if (i !== which) return s;
            if (s.preview) URL.revokeObjectURL(s.preview);
            return { ...s, preview, uploading: true, error: null };
          })
        );
      }

      const up = await categoriesAPI.uploadImage(resized);
      const url = up.data.imageUrl;
      if (which === "primary") {
        setPrimary((s) => ({ ...s, cloudUrl: url, uploading: false, error: null }));
      } else {
        setSecondary((prev) =>
          prev.map((s, i) => (i === which ? { ...s, cloudUrl: url, uploading: false, error: null } : s))
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      if (which === "primary") {
        setPrimary((s) => ({ ...s, uploading: false, error: msg }));
      } else {
        setSecondary((prev) =>
          prev.map((s, i) => (i === which ? { ...s, uploading: false, error: msg } : s))
        );
      }
    }
  };

  const processFileRef = useRef(processFileForSlot);
  processFileRef.current = processFileForSlot;

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items?.length) return;
      const fileItem = Array.from(items).find((it) => it.kind === "file" && it.type.startsWith("image/"));
      if (!fileItem) return;

      const el = document.activeElement;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement
      ) {
        if (!el.closest("[data-product-image-slot]")) {
          return;
        }
      }

      const f = fileItem.getAsFile();
      if (!f) return;
      e.preventDefault();
      void processFileRef.current(f, pasteTargetRef.current);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const primaryFinalUrl = (primary.cloudUrl || primary.manualUrl.trim()).trim();

  const handleSuggestDescription = async () => {
    const name = formName.trim() || "this product";
    setSuggestLoading(true);
    setError(null);
    try {
      const categoryName = formCategoryId ? categories.find((c) => c.id === formCategoryId)?.name ?? "" : "";
      const res = await aiAPI.suggestDescription({
        context: "Product",
        name,
        categoryName: categoryName || undefined,
        mainImageUrl: primaryFinalUrl || undefined,
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
      const categoryName = formCategoryId ? categories.find((c) => c.id === formCategoryId)?.name ?? "" : "";
      const res = await aiAPI.suggestTags({
        name: formName.trim() || undefined,
        description: formDescription.trim() || undefined,
        categoryName: categoryName || undefined,
        mainImageUrl: primaryFinalUrl || undefined,
      });
      if (res.data?.suggestion) setFormTags(res.data.suggestion);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tag suggestion failed");
    } finally {
      setSuggestTagsLoading(false);
    }
  };

  const handleSuggestFeatures = async () => {
    const name = formName.trim();
    if (!name) {
      setError("Enter a product name before suggesting features");
      return;
    }
    setSuggestFeaturesLoading(true);
    setError(null);
    try {
      const categoryName = formCategoryId ? categories.find((c) => c.id === formCategoryId)?.name ?? "" : "";
      const res = await aiAPI.suggestFeatures({
        name,
        categoryName: categoryName || undefined,
        mainImageUrl: primaryFinalUrl || undefined,
        description: formDescription.trim() || undefined,
      });
      if (res.data?.suggestion) setFormFeatures(res.data.suggestion);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Feature suggestion failed");
    } finally {
      setSuggestFeaturesLoading(false);
    }
  };
  const buildSecondaryForApi = (): string[] => {
    const main = primaryFinalUrl;
    return secondary.map((s) => {
      const u = (s.cloudUrl || s.manualUrl.trim()).trim();
      return u || main;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formName.trim()) {
      setError("Name is required");
      return;
    }
    if (!formDescription.trim()) {
      setError("Description is required");
      return;
    }
    if (!formCategoryId) {
      setError("Category is required");
      return;
    }
    const price = Number(formBasePrice);
    if (Number.isNaN(price) || price < 0) {
      setError("Base price must be 0 or greater");
      return;
    }
    if (!primaryFinalUrl) {
      setError("Primary image is required (upload a file or enter an image URL).");
      return;
    }
    if (primary.uploading || secondary.some((s) => s.uploading)) {
      setError("Wait for image uploads to finish.");
      return;
    }
    const rating = Number(formRating);
    if (!Number.isNaN(rating) && (rating < 0 || rating > 5)) {
      setError("Rating must be between 0 and 5");
      return;
    }
    const rc = Number(formReviewCount);
    if (!Number.isNaN(rc) && rc < 0) {
      setError("Review count cannot be negative");
      return;
    }

    setSubmitLoading(true);
    try {
      await productsAPI.create({
        name: formName.trim(),
        description: formDescription.trim(),
        categoryId: formCategoryId,
        basePrice: price,
        mainImageUrl: primaryFinalUrl,
        imageUrls: buildSecondaryForApi(),
        features: parseList(formFeatures),
        tags: parseList(formTags),
        rating: Math.min(5, Math.max(0, Number(formRating) || 0)),
        reviewCount: Math.max(0, Number(formReviewCount) || 0),
      });
      navigate("/products", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create product");
    } finally {
      setSubmitLoading(false);
    }
  };

  const dropHandlers = (which: "primary" | number) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const f = e.dataTransfer.files?.[0];
      void processFileForSlot(f ?? null, which);
    },
  });

  const displayUrl = (slot: ImageSlot) => slot.cloudUrl || slot.manualUrl.trim() || slot.preview || "";

  const ImageBlock = ({
    label,
    optionalLabel,
    slot,
    which,
    urlHint,
    compact,
  }: {
    label: string;
    optionalLabel?: string;
    slot: ImageSlot;
    which: "primary" | number;
    urlHint: string;
    compact?: boolean;
  }) => (
    <div
      className={`rounded-lg border border-border bg-muted/10 ${compact ? "p-2.5 space-y-2" : "p-4 space-y-3"}`}
      data-product-image-slot
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className={`font-medium text-foreground ${compact ? "text-xs" : "text-sm"}`}>{label}</span>
        {optionalLabel ? <span className="text-[11px] text-muted-foreground">{optionalLabel}</span> : null}
      </div>
      <div className={compact ? "flex flex-col gap-2" : "grid gap-4 sm:grid-cols-2 sm:gap-3"}>
        <div
          {...dropHandlers(which)}
          onMouseDown={() => {
            pasteTargetRef.current = which as PasteTarget;
          }}
          className={`flex flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-input bg-background/60 px-2 text-center transition-colors hover:bg-muted/40 ${
            compact ? "min-h-[100px] py-3" : "min-h-[140px] py-5 px-3 gap-2"
          }`}
        >
          <Upload className={`${compact ? "h-5 w-5" : "h-7 w-7"} text-muted-foreground shrink-0`} aria-hidden />
          <p className={`text-muted-foreground ${compact ? "text-[10px] leading-snug px-0.5" : "text-xs"}`}>
            Drop image, click to upload, or Ctrl+V
          </p>
          <label
            className={`inline-flex cursor-pointer rounded-md border border-input bg-background font-medium text-foreground hover:bg-accent ${
              compact ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-sm"
            }`}
          >
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void processFileForSlot(e.target.files?.[0] ?? null, which)}
            />
            Choose file
          </label>
          {slot.uploading ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1 justify-center">
              <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
            </p>
          ) : null}
          {slot.error ? <p className="text-xs text-destructive">{slot.error}</p> : null}
        </div>
        <div className={`flex min-w-0 flex-col gap-2 ${compact ? "" : "justify-center"}`}>
          <div
            className={`rounded-md border border-border overflow-hidden bg-muted shrink-0 mx-auto sm:mx-0 ${
              compact ? "aspect-square h-20 w-20 max-w-full" : "h-28 w-full max-w-[140px] sm:h-24 sm:max-w-[120px]"
            }`}
          >
            {displayUrl(slot) ? (
              <img src={displayUrl(slot)} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-[10px] text-muted-foreground px-1 text-center">
                Preview
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <label className="text-xs text-muted-foreground block mb-1">{urlHint}</label>
            <input
              type="text"
              value={slot.manualUrl}
              onFocus={() => {
                pasteTargetRef.current = which as PasteTarget;
              }}
              onChange={(e) => {
                const v = e.target.value;
                if (which === "primary") setPrimarySlot((s) => ({ ...s, manualUrl: v }));
                else setSecondarySlot(which as number, (s) => ({ ...s, manualUrl: v }));
              }}
              placeholder="https://…"
              className={`w-full rounded-md border border-input bg-background text-sm ${
                compact ? "px-2 py-1 text-xs" : "px-2 py-1.5"
              }`}
            />
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const selectedCategory = categories.find((c) => c.id === formCategoryId);
  const mismatchWarning = getNameCategoryMismatchWarning(formName, selectedCategory?.name ?? "");

  return (
    <AdminLayout title="Add product" userEmail={user?.email}>
      <div className="mx-auto max-w-6xl space-y-6">
        <button
          type="button"
          onClick={() => navigate("/products")}
          className="text-sm text-primary hover:underline"
        >
          ← Back to product list
        </button>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid gap-6 lg:grid-cols-12 lg:gap-8 lg:items-start">
            <div className="space-y-5 lg:col-span-7 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
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
                {mismatchWarning ? (
                  <div className="mt-2 rounded-md border border-amber-500/60 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:border-amber-600/50 dark:text-amber-200">
                    {mismatchWarning}
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="text-sm font-medium">Features (one per line)</label>
                  <button
                    type="button"
                    onClick={() => void handleSuggestFeatures()}
                    disabled={suggestFeaturesLoading}
                    className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                  >
                    {suggestFeaturesLoading ? "Suggesting…" : "Suggest with AI"}
                  </button>
                </div>
                <textarea
                  value={formFeatures}
                  onChange={(e) => setFormFeatures(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="text-sm font-medium">Tags (comma separated)</label>
                  <button
                    type="button"
                    onClick={handleSuggestTags}
                    disabled={suggestTagsLoading}
                    className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
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

            <div className="space-y-4 lg:col-span-5">
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6 lg:sticky lg:top-20 space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Secondary image slots are optional in the form. The API requires three secondary URLs — empty slots use
                  the primary image URL.
                </p>

                <ImageBlock
                  label="Primary image *"
                  slot={primary}
                  which="primary"
                  urlHint="Or enter image URL (optional if you uploaded a file)"
                />

                <div className="space-y-2 pt-1">
                  <p className="text-sm font-medium text-foreground">Secondary images (optional — up to 3)</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-2">
                    {[0, 1, 2].map((i) => (
                      <ImageBlock
                        key={i}
                        label={`Secondary ${i + 1}`}
                        optionalLabel="optional"
                        slot={secondary[i]!}
                        which={i}
                        urlHint="URL fallback (optional)"
                        compact
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-6 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => navigate("/products")}
              className="rounded-md px-4 py-2 text-sm font-medium border border-input hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitLoading}
              className="rounded-md px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {submitLoading ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
