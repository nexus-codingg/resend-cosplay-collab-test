import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const MAX_TOTAL_UPLOAD_BYTES = 10 * 1024 * 1024; // keep well under Resend's 40MB (after base64) limit
export const MAX_FILES = 5;

export type StoredFile = {
  filename: string;
  contentType: string;
  storagePath: string; // public URL path, e.g. /uploads/<folder>/<file>
  content: Buffer;
};

/** Pulls image files out of form data and checks count, type and total size. */
export function readImageFiles(
  formData: FormData,
  field = "images",
): { ok: true; files: File[] } | { ok: false; error: string } {
  const files = formData
    .getAll(field)
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length > MAX_FILES) return { ok: false, error: `Attach up to ${MAX_FILES} images.` };
  if (files.some((f) => !f.type.startsWith("image/")))
    return { ok: false, error: "Only image files can be attached." };
  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > MAX_TOTAL_UPLOAD_BYTES) return { ok: false, error: "Images must total 10MB or less." };

  return { ok: true, files };
}

/** Saves files under public/uploads/<folder>/ so the app can show them later. */
export async function storeFiles(files: File[], folder: string): Promise<StoredFile[]> {
  const dir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(dir, { recursive: true });

  return Promise.all(
    files.map(async (file, i) => {
      const safeName = file.name.replace(/[^\w.-]+/g, "_") || `image-${i}`;
      const filename = `${i}-${safeName}`;
      const content = Buffer.from(await file.arrayBuffer());
      await writeFile(path.join(dir, filename), content);
      return {
        filename: file.name,
        contentType: file.type,
        storagePath: `/uploads/${folder}/${filename}`,
        content,
      };
    }),
  );
}
