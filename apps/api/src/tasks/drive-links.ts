const allowedDriveHosts = new Set(["drive.google.com", "docs.google.com"]);

export type DriveLinkInput = {
  name: string;
  url: string;
  driveFileId: string | null;
  mimeType: string | null;
};

export function parseDriveLinkInput(payload: {
  name?: unknown;
  url?: unknown;
  driveFileId?: unknown;
  mimeType?: unknown;
}): { input: DriveLinkInput } | { error: string } {
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const rawUrl = typeof payload.url === "string" ? payload.url.trim() : "";
  const driveFileId =
    typeof payload.driveFileId === "string"
      ? payload.driveFileId.trim() || null
      : payload.driveFileId === undefined || payload.driveFileId === null
        ? null
        : "invalid";
  const mimeType =
    typeof payload.mimeType === "string"
      ? payload.mimeType.trim() || null
      : payload.mimeType === undefined || payload.mimeType === null
        ? null
        : "invalid";

  if (!name || name.length > 200) {
    return { error: "name is required and must be 200 characters or fewer." };
  }
  if (driveFileId === "invalid") {
    return { error: "driveFileId must be text." };
  }
  if (mimeType === "invalid") {
    return { error: "mimeType must be text." };
  }
  if (mimeType && mimeType.length > 200) {
    return { error: "mimeType must be 200 characters or fewer." };
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { error: "url must be a valid HTTPS Google Drive link." };
  }
  if (url.protocol !== "https:" || !allowedDriveHosts.has(url.hostname)) {
    return { error: "url must be a valid HTTPS Google Drive link." };
  }

  return {
    input: {
      name,
      url: url.toString(),
      driveFileId,
      mimeType,
    },
  };
}
