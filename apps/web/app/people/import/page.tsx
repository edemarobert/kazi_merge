"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "../../shell";
import { translations } from "../../translations";

const sampleCsv =
  "name,email,phoneE164,jobTitle,startDate\nBrian Kato,brian@example.com,+256700000001,Operations lead,2026-01-02";

export default function ImportPeoplePage() {
  const [csv, setCsv] = useState(sampleCsv);
  const [previewed, setPreviewed] = useState(false);
  const [preview, setPreview] = useState<{
    rows: unknown[];
    errors: { rowNumber: number; message: string }[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [imported, setImported] = useState<number | null>(null);
  const rows = useMemo(() => csv.trim().split(/\r?\n/).filter(Boolean), [csv]);

  return (
    <AppShell>
      <div className="page">
        <Link className="back-link" href="/people">
          ← {translations.people.profileBack}
        </Link>
        <header className="page-header">
          <div>
            <p className="eyebrow">{translations.importPeople.eyebrow}</p>
            <h1>{translations.importPeople.title}</h1>
            <p className="page-intro">{translations.importPeople.intro}</p>
          </div>
        </header>
        <section className="panel import-panel">
          <label className="import-label" htmlFor="csv-content">
            {translations.importPeople.csvLabel}
          </label>
          <textarea
            id="csv-content"
            value={csv}
            onChange={(event) => {
              setCsv(event.target.value);
              setPreviewed(false);
            }}
            rows={10}
          />
          <div className="import-actions">
            <button
              className="primary-button"
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const form = new FormData();
                  form.append(
                    "file",
                    new File([csv], "employees.csv", { type: "text/csv" }),
                  );
                  const response = await fetch(
                    `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"}/api/v1/people/import/preview`,
                    { method: "POST", body: form, credentials: "include" },
                  );
                  if (!response.ok) throw new Error("CSV preview failed.");
                  setPreview(await response.json());
                  setPreviewed(true);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {translations.importPeople.preview}
            </button>
            <span>
              {rows.length - 1} {translations.importPeople.rows}
            </span>
          </div>
          {previewed && (
            <div className="preview-result" role="status">
              <strong>
                {preview?.rows.length ?? 0} valid rows, {preview?.errors.length ?? 0}{" "}
                rows with errors
              </strong>
              <p>{translations.importPeople.previewNote}</p>
              {preview?.errors.map((error) => (
                <p key={error.rowNumber}>
                  Row {error.rowNumber}: {error.message}
                </p>
              ))}
              <button
                className="primary-button"
                type="button"
                disabled={busy || !preview || preview.rows.length === 0}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const form = new FormData();
                    form.append(
                      "file",
                      new File([csv], "employees.csv", { type: "text/csv" }),
                    );
                    const response = await fetch(
                      `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"}/api/v1/people/import`,
                      { method: "POST", body: form, credentials: "include" },
                    );
                    if (!response.ok) throw new Error("CSV import failed.");
                    const result = (await response.json()) as {
                      imported: { rowNumber: number }[];
                    };
                    setImported(result.imported.length);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Import valid rows
              </button>
              {imported !== null && <p>{imported} employees imported.</p>}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
