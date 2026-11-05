const allowedDriveHosts = new Set(["drive.google.com", "docs.google.com"]);

export type DriveLinkInput = {
  name: string;
  url: string;
  driveFileId: string | null;
};

export function parseDriveLinkInput(payload: {
  name?: unknown;
  url?: unknown;
  driveFileId?: unknown;
}): { input: DriveLinkInput } | { error: string } {
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const rawUrl = typeof payload.url === "string" ? payload.url.trim() : "";
  const driveFileId =
    typeof payload.driveFileId === "string"
      ? payload.driveFileId.trim() || null
      : payload.driveFileId === undefined || payload.driveFileId === null
        ? null
        : "invalid";

  if (!name || name.length > 200) {
    return { error: "name is required and must be 200 characters or fewer." };
  }
  if (driveFileId === "invalid") {
    return { error: "driveFileId must be text." };
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
    },
  };
}
