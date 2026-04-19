import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import {
  aiAPI,
  type CategoryItem,
  type ProductAssistantDraftProduct,
  productsAPI,
} from "@/lib/api";

type Phase = "idle" | "loading" | "preview" | "creating" | "done";

export type PreviewRow = {
  key: string;
  name: string;
  description: string;
  categoryId: string;
  basePrice: string;
  mainImageUrl: string;
  sec1: string;
  sec2: string;
  sec3: string;
  rating: string;
  reviewCount: string;
  features: string;
  tags: string;
  createStatus: "idle" | "pending" | "success" | "failed";
  createError?: string;
};

function parseList(s: string): string[] {
  return s
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function newRowKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function fromDraftProducts(list: ProductAssistantDraftProduct[]): PreviewRow[] {
  return list.map((p) => ({
    key: newRowKey(),
    name: p.name,
    description: p.description ?? "",
    categoryId: p.categoryId,
    basePrice: String(p.basePrice),
    mainImageUrl: p.mainImageUrl,
    sec1: p.imageUrls[0] ?? "",
    sec2: p.imageUrls[1] ?? "",
    sec3: p.imageUrls[2] ?? "",
    rating: p.rating != null ? String(p.rating) : "",
    reviewCount: String(p.reviewCount ?? 0),
    features: (p.features ?? []).join("\n"),
    tags: (p.tags ?? []).join(", "),
    createStatus: "idle" as const,
  }));
}

function mapAssistantError(
  code: string,
  message: string,
  fields?: string[]
): string {
  switch (code) {
    case "EMPTY_INPUT":
      return "Please describe the product(s) first.";
    case "PARSE_ERROR":
      return "The AI couldn't extract product data. Try being more specific — include name, price, and category.";
    case "GROQ_API_ERROR":
      return "AI service is temporarily unavailable. Try again in a moment.";
    case "RATE_LIMIT":
      return "Too many requests. Please wait a moment.";
    case "VALIDATION_ERROR": {
      if (fields?.length) {
        return `Some fields are missing: ${fields.join(", ")}. Edit them in the preview before confirming.`;
      }
      return message || "Some fields are missing. Edit them in the preview before confirming.";
    }
    default:
      return message || "The request could not be completed.";
  }
}

function isLikelyUrl(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function validatePreviewRows(
  rows: PreviewRow[]
): { ok: boolean; badCells: Set<string> } {
  const badCells = new Set<string>();
  for (const r of rows) {
    const prefix = r.key;
    if (!r.name.trim()) badCells.add(`${prefix}:name`);
    if (!r.description.trim()) badCells.add(`${prefix}:description`);
    if (!r.categoryId) badCells.add(`${prefix}:categoryId`);
    const price = Number(r.basePrice);
    if (Number.isNaN(price) || price <= 0) badCells.add(`${prefix}:basePrice`);
    if (!isLikelyUrl(r.mainImageUrl)) badCells.add(`${prefix}:mainImageUrl`);
    if (!isLikelyUrl(r.sec1)) badCells.add(`${prefix}:sec1`);
    if (!isLikelyUrl(r.sec2)) badCells.add(`${prefix}:sec2`);
    if (!isLikelyUrl(r.sec3)) badCells.add(`${prefix}:sec3`);
    if (r.rating.trim()) {
      const rt = Number(r.rating);
      if (Number.isNaN(rt) || rt < 0 || rt > 5) badCells.add(`${prefix}:rating`);
    }
    if (r.reviewCount.trim()) {
      const rcNum = Number(r.reviewCount);
      if (Number.isNaN(rcNum) || rcNum < 0) badCells.add(`${prefix}:reviewCount`);
    }
  }
  return { ok: badCells.size === 0, badCells };
}

export function ProductAiAssistantModal({
  open,
  onClose,
  categories,
  onCompleted,
}: {
  open: boolean;
  onClose: () => void;
  categories: CategoryItem[];
  onCompleted: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [inputText, setInputText] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [previewHint, setPreviewHint] = useState<string | null>(null);
  const [doneSummary, setDoneSummary] = useState<{ ok: number; fail: number } | null>(null);

  useEffect(() => {
    if (!open) {
      setPhase("idle");
      setInputText("");
      setInlineError(null);
      setRows([]);
      setPreviewHint(null);
      setDoneSummary(null);
    }
  }, [open]);

  const validation = useMemo(() => validatePreviewRows(rows), [rows]);
  const confirmDisabled = phase !== "preview" || rows.length === 0 || !validation.ok;

  const updateRow = useCallback((key: string, patch: Partial<PreviewRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }, []);

  const handleAnalyze = async () => {
    setInlineError(null);
    const trimmed = inputText.trim();
    if (!trimmed) {
      setInlineError("Please describe the product(s) first.");
      return;
    }
    setPhase("loading");
    try {
      const res = await aiAPI.productAssistantDraft({ message: trimmed });
      if (!res.success) {
        setPhase("idle");
        setInlineError(mapAssistantError(res.error, res.message, res.fields));
        return;
      }
      setRows(fromDraftProducts(res.products));
      setPhase("preview");
      setPreviewHint(null);
    } catch (e) {
      setPhase("idle");
      if (e instanceof Error && e.message === "__NETWORK__") {
        setInlineError("Could not reach the server. Check your connection.");
      } else {
        setInlineError(e instanceof Error ? e.message : "Could not reach the server. Check your connection.");
      }
    }
  };

  const runCreates = async (targetKeys: Set<string>) => {
    setPhase("creating");
    setPreviewHint(null);
    setRows((prev) =>
      prev.map((x) =>
        targetKeys.has(x.key) ? { ...x, createStatus: "pending" as const, createError: undefined } : x
      )
    );
    let ok = 0;
    let fail = 0;

    for (const r of rows) {
      if (!targetKeys.has(r.key)) continue;
      try {
        await productsAPI.create({
          name: r.name.trim(),
          description: r.description.trim(),
          categoryId: r.categoryId,
          basePrice: Number(r.basePrice),
          mainImageUrl: r.mainImageUrl.trim(),
          imageUrls: [r.sec1, r.sec2, r.sec3].map((s) => s.trim()),
          features: parseList(r.features),
          tags: parseList(r.tags),
          rating: Math.min(5, Math.max(0, Number(r.rating) || 0)),
          reviewCount: Math.max(0, Math.floor(Number(r.reviewCount)) || 0),
        });
        ok += 1;
        setRows((prev) =>
          prev.map((x) => (x.key === r.key ? { ...x, createStatus: "success", createError: undefined } : x))
        );
      } catch (err) {
        fail += 1;
        const msg = err instanceof Error ? err.message : "Failed to create product";
        setRows((prev) =>
          prev.map((x) => (x.key === r.key ? { ...x, createStatus: "failed", createError: msg } : x))
        );
      }
    }

    setDoneSummary({ ok, fail });
    setPhase("done");
    if (ok > 0) onCompleted();
  };

  const handleConfirmCreate = () => {
    if (!validation.ok) return;
    setPreviewHint(null);
    void runCreates(new Set(rows.map((r) => r.key)));
  };

  const handleRetryFailed = () => {
    const failed = rows.filter((r) => r.createStatus === "failed");
    if (failed.length === 0) return;
    void runCreates(new Set(failed.map((r) => r.key)));
  };

  const handleTryAgain = () => {
    setPhase("idle");
    setRows([]);
    setPreviewHint(null);
    setInlineError(null);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/50 dark:bg-black/60 overflow-y-auto">
      <div className="w-full max-w-5xl max-h-[calc(100vh-1.5rem)] min-h-0 flex flex-col rounded-xl bg-card border border-border shadow-xl my-auto">
        <div className="flex shrink-0 items-center justify-between gap-2 px-4 sm:px-6 pt-4 sm:pt-5 pb-2 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">AI product assistant</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
          {(phase === "idle" || phase === "loading") && (
            <>
              <p className="text-sm text-muted-foreground">
                Describe one or many products in plain language (names, prices, categories, image URLs if you have
                them). The AI will draft rows you can edit before creating.
              </p>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={phase === "loading"}
                rows={5}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                placeholder="Example: Add a blue cotton t-shirt for $29.99 in Shirts, and a black hoodie for 49 in Hoodies. Main image https://…"
              />
              {inlineError ? <p className="text-sm text-destructive">{inlineError}</p> : null}
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={phase === "loading"}
                  onClick={() => void handleAnalyze()}
                  className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {phase === "loading" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Analyzing your input…
                    </>
                  ) : (
                    "Analyze with AI"
                  )}
                </button>
              </div>
            </>
          )}

          {phase === "preview" && (
            <>
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <p className="text-sm font-medium text-foreground">Preview — edit as needed, then confirm.</p>
                <button
                  type="button"
                  onClick={handleTryAgain}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Try again
                </button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-xs sm:text-sm min-w-[800px]">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="p-2 font-medium">Name *</th>
                      <th className="p-2 font-medium">Description *</th>
                      <th className="p-2 font-medium">Category *</th>
                      <th className="p-2 font-medium">Price *</th>
                      <th className="p-2 font-medium">Main URL *</th>
                      <th className="p-2 font-medium">Sec 1–3 *</th>
                      <th className="p-2 font-medium">Rating</th>
                      <th className="p-2 font-medium">Review count</th>
                      <th className="p-2 font-medium">Features</th>
                      <th className="p-2 font-medium">Tags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const bad = (field: string) =>
                        validation.badCells.has(`${r.key}:${field}`)
                          ? "border-destructive/80 bg-destructive/5"
                          : "";
                      return (
                        <tr key={r.key} className="border-b border-border last:border-0 align-top">
                          <td className={`p-1 ${bad("name")}`}>
                            <input
                              value={r.name}
                              onChange={(e) => updateRow(r.key, { name: e.target.value })}
                              className="w-full min-w-[100px] rounded border border-input bg-background px-1 py-1"
                            />
                          </td>
                          <td className={`p-1 ${bad("description")}`}>
                            <textarea
                              value={r.description}
                              onChange={(e) => updateRow(r.key, { description: e.target.value })}
                              rows={2}
                              className="w-full min-w-[120px] rounded border border-input bg-background px-1 py-1"
                            />
                          </td>
                          <td className={`p-1 ${bad("categoryId")}`}>
                            <select
                              value={r.categoryId}
                              onChange={(e) => updateRow(r.key, { categoryId: e.target.value })}
                              className="w-full min-w-[100px] rounded border border-input bg-background px-1 py-1"
                            >
                              <option value="">Select…</option>
                              {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className={`p-1 ${bad("basePrice")}`}>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={r.basePrice}
                              onChange={(e) => updateRow(r.key, { basePrice: e.target.value })}
                              className="w-full min-w-[72px] rounded border border-input bg-background px-1 py-1"
                            />
                          </td>
                          <td className={`p-1 ${bad("mainImageUrl")}`}>
                            <input
                              value={r.mainImageUrl}
                              onChange={(e) => updateRow(r.key, { mainImageUrl: e.target.value })}
                              className="w-full min-w-[120px] rounded border border-input bg-background px-1 py-1"
                            />
                          </td>
                          <td className="p-1 space-y-1 min-w-[140px]">
                            <input
                              value={r.sec1}
                              onChange={(e) => updateRow(r.key, { sec1: e.target.value })}
                              className={`w-full rounded border border-input bg-background px-1 py-0.5 ${bad("sec1")}`}
                            />
                            <input
                              value={r.sec2}
                              onChange={(e) => updateRow(r.key, { sec2: e.target.value })}
                              className={`w-full rounded border border-input bg-background px-1 py-0.5 ${bad("sec2")}`}
                            />
                            <input
                              value={r.sec3}
                              onChange={(e) => updateRow(r.key, { sec3: e.target.value })}
                              className={`w-full rounded border border-input bg-background px-1 py-0.5 ${bad("sec3")}`}
                            />
                          </td>
                          <td className={`p-1 ${bad("rating")}`}>
                            <input
                              value={r.rating}
                              onChange={(e) => updateRow(r.key, { rating: e.target.value })}
                              className="w-full min-w-[56px] rounded border border-input bg-background px-1 py-1"
                              placeholder="0–5"
                            />
                          </td>
                          <td className={`p-1 ${bad("reviewCount")}`}>
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={r.reviewCount}
                              onChange={(e) => updateRow(r.key, { reviewCount: e.target.value })}
                              className="w-full min-w-[64px] rounded border border-input bg-background px-1 py-1"
                            />
                          </td>
                          <td className="p-1">
                            <textarea
                              value={r.features}
                              onChange={(e) => updateRow(r.key, { features: e.target.value })}
                              rows={2}
                              className="w-full min-w-[100px] rounded border border-input bg-background px-1 py-1"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              value={r.tags}
                              onChange={(e) => updateRow(r.key, { tags: e.target.value })}
                              className="w-full min-w-[100px] rounded border border-input bg-background px-1 py-1"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {previewHint ? <p className="text-sm text-destructive">{previewHint}</p> : null}
              {!validation.ok && rows.length > 0 ? (
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Fill in highlighted fields before creating.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  onClick={handleTryAgain}
                  className="rounded-md px-4 py-2 text-sm font-medium border border-input hover:bg-accent"
                >
                  Try again
                </button>
                <button
                  type="button"
                  disabled={confirmDisabled}
                  onClick={handleConfirmCreate}
                  className="rounded-md px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Confirm & create
                </button>
              </div>
            </>
          )}

          {phase === "creating" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Creating products…
              </p>
              <ul className="text-sm space-y-1">
                {rows.map((r) => (
                  <li key={r.key} className="flex flex-wrap gap-2 items-baseline">
                    <span className="font-medium truncate max-w-[200px]">{r.name || "—"}</span>
                    <span className="text-muted-foreground text-xs">
                      {r.createStatus === "pending" && "Creating…"}
                      {r.createStatus === "success" && "Created"}
                      {r.createStatus === "failed" && <span className="text-destructive">Failed: {r.createError}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {phase === "done" && doneSummary && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-foreground">
                {doneSummary.ok} created successfully
                {doneSummary.fail > 0 ? `, ${doneSummary.fail} failed` : ""}.
              </p>
              <div className="flex flex-wrap gap-2">
                {rows.some((r) => r.createStatus === "failed") ? (
                  <button
                    type="button"
                    onClick={() => void handleRetryFailed()}
                    className="rounded-md px-4 py-2 text-sm font-medium border border-input hover:bg-accent"
                  >
                    Retry failed
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
