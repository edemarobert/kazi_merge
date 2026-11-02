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
              onClick={() => setPreviewed(true)}
            >
              {translations.importPeople.preview}
            </button>
            <span>
              {rows.length - 1} {translations.importPeople.rows}
            </span>
          </div>
          {previewed && (
            <div className="preview-result" role="status">
              <strong>{translations.importPeople.previewReady}</strong>
              <p>{translations.importPeople.previewNote}</p>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
