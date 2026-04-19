import { useEffect, useRef, useState } from "react";
import { aiAPI } from "@/lib/api";
import { categoriesAPI } from "@/lib/api";

const requiredAspect = { w: 1, h: 1 };
const aspectTolerance = 0.05;

export type CategoryEditorInitialValues = {
  name: string;
  imageUrl: string;
  description: string;
};

type Props = {
  initialValues: CategoryEditorInitialValues;
  onSubmit: (body: { name: string; imageUrl: string; description?: string }) => Promise<void>;
  onCancel?: () => void;
  submitLabel: string;
  cancelLabel?: string;
  listenPaste?: boolean;
  className?: string;
};

function formatAspect(a: { w: number; h: number }) {
  return `${a.w}:${a.h}`;
}

export function CategoryEditorForm({
  initialValues,
  onSubmit,
  onCancel,
  submitLabel,
  cancelLabel = "Cancel",
  listenPaste = true,
  className = "",
}: Props) {
  const [formName, setFormName] = useState(initialValues.name);
  const [formImageUrl, setFormImageUrl] = useState(initialValues.imageUrl);
  const [formDescription, setFormDescription] = useState(initialValues.description);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [imageInlineError, setImageInlineError] = useState<string | null>(null);
  const [imageCanAutoResize, setImageCanAutoResize] = useState(false);

  useEffect(() => {
    setFormName(initialValues.name);
    setFormImageUrl(initialValues.imageUrl);
    setFormDescription(initialValues.description);
    setImageFile(null);
    setImageInlineError(null);
    setImageCanAutoResize(false);
    setImagePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });
  }, [initialValues.name, initialValues.imageUrl, initialValues.description]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const validateSelectedImage = async (file: File): Promise<void> => {
    setImageInlineError(null);
    setImageCanAutoResize(false);

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setImageInlineError("Invalid file type. Use JPG, PNG, or WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setImageInlineError("Image must be 2MB or smaller.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to read image"));
        img.src = objectUrl;
      });
      const w = img.naturalWidth || 0;
      const h = img.naturalHeight || 0;
      if (!w || !h) {
        setImageInlineError("Invalid image file.");
        return;
      }
      const actual = w / h;
      const required = requiredAspect.w / requiredAspect.h;
      const within = Math.abs(actual - required) / required <= aspectTolerance;
      if (!within) {
        setImageInlineError(
          `Image ratio must be ${formatAspect(requiredAspect)} to match category display. Use Auto Resize to fix.`
        );
        setImageCanAutoResize(true);
      }
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const cropToAspect = async (file: File, aspect: { w: number; h: number }): Promise<File> => {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to read image"));
        img.src = objectUrl;
      });
      const srcW = img.naturalWidth;
      const srcH = img.naturalHeight;
      const target = aspect.w / aspect.h;

      let cropW = srcW;
      let cropH = srcH;
      if (srcW / srcH > target) {
        cropW = Math.round(srcH * target);
        cropH = srcH;
      } else {
        cropW = srcW;
        cropH = Math.round(srcW / target);
      }
      const sx = Math.max(0, Math.round((srcW - cropW) / 2));
      const sy = Math.max(0, Math.round((srcH - cropH) / 2));

      const canvas = document.createElement("canvas");
      const outSize = Math.min(1024, Math.max(256, Math.min(cropW, cropH)));
      canvas.width = aspect.w === aspect.h ? outSize : Math.round(outSize * target);
      canvas.height = aspect.w === aspect.h ? outSize : Math.round(outSize / target);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");
      ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, canvas.width, canvas.height);

      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Failed to encode image"))),
          "image/webp",
          0.92
        );
      });
      const name = file.name.replace(/\.[^.]+$/, "") || "category";
      return new File([blob], `${name}.webp`, { type: "image/webp" });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  async function handleImagePick(file: File | null) {
    setImageInlineError(null);
    setImageCanAutoResize(false);
    setImageFile(null);
    setFormImageUrl("");
    setImagePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });
    if (!file) return;

    setImageFile(file);
    const nextPreview = URL.createObjectURL(file);
    setImagePreviewUrl(nextPreview);
    await validateSelectedImage(file);
  }

  const handleImagePickRef = useRef(handleImagePick);
  handleImagePickRef.current = handleImagePick;

  useEffect(() => {
    if (!listenPaste) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items || items.length === 0) return;
      const fileItem = Array.from(items).find((it) => it.kind === "file" && it.type.startsWith("image/"));
      if (!fileItem) return;
      const f = fileItem.getAsFile();
      if (!f) return;
      e.preventDefault();
      void handleImagePickRef.current(f);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [listenPaste]);

  const handleAutoResize = async () => {
    if (!imageFile) return;
    setImageInlineError(null);
    setImageCanAutoResize(false);
    try {
      const resized = await cropToAspect(imageFile, requiredAspect);
      setImageFile(resized);
      setImagePreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(resized);
      });
      await validateSelectedImage(resized);
    } catch {
      setImageInlineError("Auto Resize failed. Please try another image.");
      setImageCanAutoResize(false);
    }
  };

  const handleSuggestDescription = async () => {
    const name = formName.trim() || "this category";
    setSuggestLoading(true);
    try {
      const res = await aiAPI.suggestDescription({
        context: "Category",
        name,
      });
      if (res.data?.suggestion) setFormDescription(res.data.suggestion);
    } finally {
      setSuggestLoading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      let imageUrl = formImageUrl.trim();
      if (imageFile) {
        if (imageInlineError) {
          setSubmitLoading(false);
          return;
        }
        const up = await categoriesAPI.uploadImage(imageFile);
        imageUrl = up.data.imageUrl;
        setFormImageUrl(imageUrl);
      }
      await onSubmit({
        name: formName.trim(),
        imageUrl,
        description: formDescription.trim() || undefined,
      });
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleFormSubmit(e)} className={`space-y-4 ${className}`}>
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
        <label className="block text-sm font-medium mb-1">Image</label>
        <div className="rounded-md border border-input bg-background p-3">
          <div className="flex items-start gap-3">
            <div className="h-16 w-16 rounded-md bg-muted overflow-hidden border border-border flex items-center justify-center">
              {imagePreviewUrl ? (
                <img src={imagePreviewUrl} alt="Preview" className="h-full w-full object-cover" />
              ) : formImageUrl ? (
                <img src={formImageUrl} alt="Preview" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-muted-foreground">No image</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium border border-input hover:bg-accent cursor-pointer">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => void handleImagePick(e.target.files?.[0] ?? null)}
                  />
                  Choose image
                </label>
                <button
                  type="button"
                  onClick={() => void handleAutoResize()}
                  disabled={!imageCanAutoResize || submitLoading}
                  className="rounded-md px-3 py-2 text-sm font-medium bg-muted hover:bg-muted/80 disabled:opacity-50"
                >
                  Auto Resize
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Allowed: JPG/PNG/WebP up to 2MB. Required ratio: {formatAspect(requiredAspect)}.
              </p>
            </div>
          </div>
          {imageInlineError && <p className="mt-2 text-sm text-destructive">{imageInlineError}</p>}
        </div>
        <div className="mt-3">
          <label className="block text-sm font-medium mb-1">Image URL (optional if you upload a file)</label>
          <input
            type="url"
            value={formImageUrl}
            onChange={(e) => {
              setFormImageUrl(e.target.value);
              setImageFile(null);
              setImageCanAutoResize(false);
              setImageInlineError(null);
              setImagePreviewUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return "";
              });
            }}
            placeholder="https://…"
            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <label className="block text-sm font-medium">Description (optional)</label>
          <button
            type="button"
            onClick={() => void handleSuggestDescription()}
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
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm font-medium border border-input hover:bg-accent"
          >
            {cancelLabel}
          </button>
        ) : null}
        <button
          type="submit"
          disabled={submitLoading || Boolean(imageInlineError) || (!imageFile && !formImageUrl.trim())}
          className="rounded-md px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {submitLoading ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
