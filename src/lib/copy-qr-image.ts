/** PNG blob z canvasu (QR kód) pro schránku. */
export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("toBlob failed"));
    }, "image/png");
  });
}

export async function copyCanvasQrToClipboard(canvas: HTMLCanvasElement | null): Promise<boolean> {
  if (!canvas || !navigator.clipboard?.write) return false;
  try {
    const blob = await canvasToPngBlob(canvas);
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch {
    return false;
  }
}
