"use client";

// Downscale a photo in the browser so uploads stay small and fast.
// Claude works best with the longest edge around 1500 px.
export async function prepareImage(
  file: File,
  maxEdge = 1568,
  quality = 0.85,
): Promise<{ dataUrl: string; thumbnail: string }> {
  const bitmap = await loadImage(file);
  const dataUrl = drawToJpeg(bitmap, maxEdge, quality);
  const thumbnail = drawToJpeg(bitmap, 240, 0.7);
  return { dataUrl, thumbnail };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image. Try a JPEG or PNG."));
    };
    img.src = url;
  });
}

function drawToJpeg(img: HTMLImageElement, maxEdge: number, quality: number): string {
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}
