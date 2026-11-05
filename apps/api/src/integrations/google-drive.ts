const spreadsheetFileIdPattern = /^[A-Za-z0-9_-]{1,200}$/;

export function validateSpreadsheetFileId(fileId: unknown): string {
  if (typeof fileId !== "string" || !spreadsheetFileIdPattern.test(fileId.trim())) {
    throw new Error("A valid Google Sheet file id is required.");
  }
  return fileId.trim();
}

export async function exportGoogleSheetCsv(
  fileId: string,
  accessToken: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const response = await fetcher(
    "https://www.googleapis.com/drive/v3/files/" +
      encodeURIComponent(validateSpreadsheetFileId(fileId)) +
      "/export?mimeType=text%2Fcsv",
    {
      headers: { Authorization: "Bearer " + accessToken },
    },
  );
  if (!response.ok) {
    throw new Error("Google Sheet export failed.");
  }
  const csv = await response.text();
  if (Buffer.byteLength(csv, "utf8") > 2 * 1024 * 1024) {
    throw new Error("Google Sheet export exceeds the 2 MB import limit.");
  }
  return csv;
}
