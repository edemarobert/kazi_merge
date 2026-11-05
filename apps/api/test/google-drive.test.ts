import assert from "node:assert/strict";
import { test } from "node:test";
import {
  exportGoogleSheetCsv,
  validateSpreadsheetFileId,
} from "../src/integrations/google-drive.js";

test("Google Sheet export validates the selected file id and returns CSV", async () => {
  const calls: { url: string; token?: string }[] = [];
  const csv = await exportGoogleSheetCsv(
    "sheet_file-1",
    "access-token",
    async (url, init) => {
      calls.push({
        url: String(url),
        token: new Headers(init?.headers).get("authorization") ?? undefined,
      });
      return {
        ok: true,
        text: async () => "name,email,phoneE164\nAlice,alice@example.com,+256700000001",
      } as Response;
    },
  );

  assert.equal(csv, "name,email,phoneE164\nAlice,alice@example.com,+256700000001");
  assert.equal(
    calls[0]?.url,
    "https://www.googleapis.com/drive/v3/files/sheet_file-1/export?mimeType=text%2Fcsv",
  );
  assert.equal(calls[0]?.token, "Bearer access-token");
});

test("Google Sheet export rejects malformed file ids", () => {
  assert.throws(
    () => validateSpreadsheetFileId("https://drive.google.com/file/d/abc"),
    /valid Google Sheet file id/,
  );
});
