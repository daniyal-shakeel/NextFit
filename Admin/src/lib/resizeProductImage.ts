
export async function resizeImageTo800Square(file: File): Promise<File> {
  const aspect = { w: 1, h: 1 };
  const target = aspect.w / aspect.h;
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

    const outSize = 800;
    const canvas = document.createElement("canvas");
    canvas.width = outSize;
    canvas.height = outSize;
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
    const name = file.name.replace(/\.[^.]+$/, "") || "product";
    return new File([blob], `${name}.webp`, { type: "image/webp" });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
