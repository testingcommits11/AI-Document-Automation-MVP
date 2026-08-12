import { IndustryKey, IndustryMeta, ProcessResult, SessionRecord } from "./types";

// Set NEXT_PUBLIC_API_BASE_URL in .env.local / Vercel project settings.
// Falls back to localhost for local development against `uvicorn main:app`.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export async function fetchIndustries(): Promise<Record<IndustryKey, IndustryMeta>> {
  const res = await fetch(`${API_BASE}/api/industries`);
  if (!res.ok) throw new Error("Could not load industry configuration from the API.");
  return res.json();
}

export function demoPdfUrl(industry: IndustryKey, negative = false): string {
  return `${API_BASE}/api/demo/${industry}${negative ? "?negative=true" : ""}`;
}

export async function fetchDemoPdf(industry: IndustryKey, negative = false): Promise<Blob> {
  const res = await fetch(demoPdfUrl(industry, negative));
  if (!res.ok) throw new Error("Could not load the demo PDF.");
  return res.blob();
}

export async function processDocument(industry: IndustryKey, file: File | Blob, filename: string): Promise<ProcessResult> {
  const form = new FormData();
  form.append("industry", industry);
  form.append("file", file, filename);

  const res = await fetch(`${API_BASE}/api/process`, { method: "POST", body: form });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Processing failed." }));
    throw new Error(body.detail || "Processing failed.");
  }
  return res.json();
}

export async function exportUpdatedPdf(industry: IndustryKey, extracted: Record<string, string>): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/export-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ industry, extracted }),
  });

  if (!res.ok) {
    throw new Error("Failed to export updated PDF.");
  }
  return res.blob();
}

export async function exportCombinedPdf(records: SessionRecord[]): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/export-combined-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      records: records.map((r) => ({
        industry: r.industry,
        extracted: r.extracted,
        sourceLabel: r.sourceLabel,
      })),
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Failed to export combined PDF." }));
    throw new Error(body.detail || "Failed to export combined PDF.");
  }
  return res.blob();
}
