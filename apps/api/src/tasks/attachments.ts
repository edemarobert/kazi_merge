import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import multer from "multer";

export const maxAttachmentBytes = 10 * 1024 * 1024;

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "text/plain",
]);

export const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxAttachmentBytes },
  fileFilter: (_request, file, callback) => {
    callback(null, allowedMimeTypes.has(file.mimetype));
  },
});

function safeFileName(name: string): string {
  const baseName = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
  return baseName.slice(-120) || "attachment";
}

export async function saveAttachment(file: Express.Multer.File): Promise<{
  name: string;
  storageKey: string;
  mimeType: string;
}> {
  const name = safeFileName(file.originalname);
  const storageKey = path.posix.join("attachments", `${randomUUID()}-${name}`);
  const storageRoot =
    process.env.ATTACHMENTS_DIR ?? path.join(process.cwd(), "uploads");
  const absolutePath = path.join(storageRoot, storageKey);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, file.buffer, { flag: "wx" });
  return { name, storageKey, mimeType: file.mimetype };
}
