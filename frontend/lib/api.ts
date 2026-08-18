import {
  FieldDefinition,
  IndustryKey,
  IndustryMeta,
  ProcessResult,
  SessionRecord,
} from "./types";
import {
  getAuthToken,
  setAuthToken,
  clearAuthToken,
} from "./auth";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return body.detail || body.message || fallback;
}

export async function fetchIndustries(): Promise<Record<IndustryKey, IndustryMeta>> {
  const res = await fetch(`${API_BASE}/api/industries`, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error(await readError(res, "Could not load industry configuration from the API."));
  return res.json();
}

export function demoPdfUrl(industry: IndustryKey, negative = false): string {
  return `${API_BASE}/api/demo/${industry}${negative ? "?negative=true" : ""}`;
}

export async function fetchDemoPdf(industry: IndustryKey, negative = false): Promise<Blob> {
  const res = await fetch(demoPdfUrl(industry, negative), { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error(await readError(res, "Could not load the demo PDF."));
  return res.blob();
}

export async function processDocument(industry: IndustryKey, file: File | Blob, filename: string): Promise<ProcessResult> {
  const form = new FormData();
  form.append("industry", industry);
  form.append("file", file, filename);

  const res = await fetch(`${API_BASE}/api/process`, {
    method: "POST",
    headers: { ...authHeaders() },
    body: form,
  });

  if (!res.ok) throw new Error(await readError(res, "Processing failed."));
  return res.json();
}

export async function fetchDocuments(): Promise<SessionRecord[]> {
  const res = await fetch(`${API_BASE}/api/documents`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error(await readError(res, "Could not load processed documents."));

  const body = await res.json();
  return (body.documents || []).map((doc: any) => ({
    id: String(doc.id),
    industry: doc.industry,
    extracted: doc.extracted || {},
    validation: doc.validation || [],
    overall: doc.overall,
    ai_provider: doc.ai_provider || undefined,
    fallback_used: Boolean(doc.fallback_used),
    field_schema: doc.field_schema || [],
    fieldSchema: doc.field_schema || [],
    sourceLabel: doc.source_label || "document.pdf",
    docTitle: doc.doc_title,
    industryLabel: doc.industry_label,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
    document_id: doc.id,
  }));
}

export async function deleteProcessedDocument(
  documentId: number,
): Promise<{ ok: boolean; document_id: number }> {
  const res = await fetch(`${API_BASE}/api/documents/${documentId}`, {
    method: "DELETE",
    headers: {
      ...authHeaders(),
    },
  });

  if (!res.ok) {
    throw new Error(
      await readError(
        res,
        "Could not delete the processed document.",
      ),
    );
  }

  return res.json();
}

export async function updateProcessedDocument(
  documentId: number,
  extracted: Record<string, string>,
  validation?: any[],
  overall?: string,
): Promise<SessionRecord> {
  const res = await fetch(`${API_BASE}/api/documents/${documentId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ extracted, validation, overall }),
  });

  if (!res.ok) throw new Error(await readError(res, "Could not save document changes."));
  const doc = await res.json();
  return {
    id: String(doc.id),
    industry: doc.industry,
    extracted: doc.extracted || {},
    validation: doc.validation || [],
    overall: doc.overall,
    ai_provider: doc.ai_provider || undefined,
    fallback_used: Boolean(doc.fallback_used),
    field_schema: doc.field_schema || [],
    fieldSchema: doc.field_schema || [],
    sourceLabel: doc.source_label || "document.pdf",
    docTitle: doc.doc_title,
    industryLabel: doc.industry_label,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
    document_id: doc.id,
  };
}

export async function exportUpdatedPdf(
  industry: IndustryKey,
  extracted: Record<string, string>,
  fieldSchema?: FieldDefinition[],
): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/export-pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ industry, extracted, field_schema: fieldSchema || null }),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to export updated PDF."));
  return res.blob();
}

export async function exportCombinedPdf(records: SessionRecord[]): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/export-combined-pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({
      records: records.map((record) => ({
        industry: record.industry,
        extracted: record.extracted,
        sourceLabel: record.sourceLabel,
        fieldSchema: record.fieldSchema || record.field_schema || [],
      })),
    }),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to export combined PDF."));
  return res.blob();
}

export async function getFields(industry: IndustryKey) {
  const res = await fetch(`${API_BASE}/api/fields/${industry}`, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error(await readError(res, "Failed to load fields."));
  return res.json();
}

export async function createField(industry: IndustryKey, payload: { label: string; type: string; key?: string }) {
  const res = await fetch(`${API_BASE}/api/fields/${industry}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to add field."));
  return res.json();
}

export async function updateField(industry: IndustryKey, fieldId: number, payload: { label: string; type: string }) {
  const res = await fetch(`${API_BASE}/api/fields/${industry}/${fieldId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to update field."));
  return res.json();
}

export async function deleteField(industry: IndustryKey, fieldId: number) {
  const res = await fetch(`${API_BASE}/api/fields/${industry}/${fieldId}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to remove field."));
  return res.json();
}

export async function emailPdf(
  industry: IndustryKey,
  extracted: Record<string, string>,
  recipient: string,
  filename?: string,
  fieldSchema?: FieldDefinition[],
): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/api/email-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      industry,
      extracted,
      recipient,
      filename: filename || `${industry}_updated.pdf`,
      field_schema: fieldSchema || null,
    }),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to send PDF email."));
  return res.json();
}

export async function emailUpdatedPdf(
  industry: IndustryKey,
  extracted: Record<string, string>,
  recipient: string,
  fieldSchema?: FieldDefinition[],
): Promise<{ ok: boolean; message: string }> {
  return emailPdf(industry, extracted, recipient, `${industry}_updated.pdf`, fieldSchema);
}

export async function emailCombinedPdf(records: SessionRecord[], recipient: string): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/api/email-combined-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      records: records.map((record) => ({
        industry: record.industry,
        extracted: record.extracted,
        sourceLabel: record.sourceLabel,
        fieldSchema: record.fieldSchema || record.field_schema || [],
      })),
      recipient,
    }),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to send combined PDF email."));
  return res.json();
}

export async function register(email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await readError(res, "Registration failed."));
  const body = await res.json();
  setAuthToken(body.access_token);
  return body;
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await readError(res, "Login failed."));
  const body = await res.json();
  setAuthToken(body.access_token);
  return body;
}

export async function fetchCurrentUser() {
  const res = await fetch(`${API_BASE}/api/auth/me`, { headers: { ...authHeaders() } });
  if (!res.ok) {
    clearAuthToken();
    return null;
  }
  return res.json();
}

export function logout() {
  clearAuthToken();
}