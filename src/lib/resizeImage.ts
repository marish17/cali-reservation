/**
 * Riduce una foto a un quadrato prima di caricarla. Una foto da
 * telefono pesa svariati megabyte: caricarla intera consumerebbe
 * l'archivio e rallenterebbe ogni schermata che la mostra, per un
 * cerchietto da trentadue pixel.
 */
export async function resizeToSquare(file: File, size = 256): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  // Ritaglio centrale: le foto verticali non vanno schiacciate.
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("CANVAS_UNAVAILABLE");
  context.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85)
  );
  if (!blob) throw new Error("ENCODE_FAILED");
  return blob;
}
