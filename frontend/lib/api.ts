import {
  FieldDefinition,
  IndustryKey,
  IndustryMeta,
  ProcessResult,
  SessionRecord,
} from "./types";

import {
  clearAuthToken,
  getAuthToken,
  setAuthToken,
} from "./auth";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");


function authHeaders(): HeadersInit {
  const token =
    getAuthToken();

  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
}


async function readError(
  response: Response,
  fallback: string,
): Promise<string> {
  const body =
    await response
      .json()
      .catch(() => ({}));

  return (
    body.detail ||
    body.message ||
    fallback
  );
}


async function fetchWithAuth(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const response =
    await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        ...authHeaders(),
      },
    });

  if (
    response.status === 401
  ) {
    clearAuthToken();

    if (
      typeof window !== "undefined"
    ) {
      window.dispatchEvent(
        new Event("auth-expired"),
      );
    }
  }

  return response;
}


// ============================================================================
// AUTH
// ============================================================================

export async function register(
  email: string,
  password: string,
) {
  const response =
    await fetch(
      `${API_BASE}/api/auth/register`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      },
    );

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Registration failed.",
      ),
    );
  }

  const body =
    await response.json();

  setAuthToken(
    body.access_token,
  );

  return body;
}


export async function login(
  email: string,
  password: string,
) {
  const response =
    await fetch(
      `${API_BASE}/api/auth/login`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      },
    );

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Login failed.",
      ),
    );
  }

  const body =
    await response.json();

  setAuthToken(
    body.access_token,
  );

  return body;
}


export async function fetchCurrentUser() {
  const response =
    await fetchWithAuth(
      `${API_BASE}/api/auth/me`,
      {
        method: "GET",
      },
    );

  if (!response.ok) {
    clearAuthToken();
    return null;
  }

  return response.json();
}


export function logout() {
  clearAuthToken();

  if (
    typeof window !== "undefined"
  ) {
    window.dispatchEvent(
      new Event("auth-logged-out"),
    );
  }
}


// ============================================================================
// INDUSTRIES
// ============================================================================

export async function fetchIndustries(): Promise<
  Record<
    IndustryKey,
    IndustryMeta
  >
> {
  const response =
    await fetchWithAuth(
      `${API_BASE}/api/industries`,
    );

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Could not load industry configuration from the API.",
      ),
    );
  }

  return response.json();
}


// ============================================================================
// DEMO PDF
// ============================================================================

export function demoPdfUrl(
  industry: IndustryKey,
  negative = false,
): string {
  return `${API_BASE}/api/demo/${industry}${
    negative
      ? "?negative=true"
      : ""
  }`;
}


export async function fetchDemoPdf(
  industry: IndustryKey,
  negative = false,
): Promise<Blob> {
  const response =
    await fetchWithAuth(
      demoPdfUrl(
        industry,
        negative,
      ),
    );

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Could not load the demo PDF.",
      ),
    );
  }

  return response.blob();
}


// ============================================================================
// PROCESS
// ============================================================================

export async function processDocument(
  industry: IndustryKey,
  file: File | Blob,
  filename: string,
): Promise<ProcessResult> {
  const form =
    new FormData();

  form.append(
    "industry",
    industry,
  );

  form.append(
    "file",
    file,
    filename,
  );

  const response =
    await fetchWithAuth(
      `${API_BASE}/api/process`,
      {
        method: "POST",
        body: form,
      },
    );

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Processing failed.",
      ),
    );
  }

  return response.json();
}


// ============================================================================
// DOCUMENTS
// ============================================================================

export async function fetchDocuments(): Promise<
  SessionRecord[]
> {
  const response =
    await fetchWithAuth(
      `${API_BASE}/api/documents`,
    );

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Could not load processed documents.",
      ),
    );
  }

  const body =
    await response.json();

  return (
    body.documents || []
  ).map((doc: any) => ({
    id: String(doc.id),
    document_id: doc.id,
    industry: doc.industry,
    extracted: doc.extracted || {},
    validation: doc.validation || [],
    overall: doc.overall,
    ai_provider:
      doc.ai_provider ||
      undefined,
    fallback_used: Boolean(
      doc.fallback_used,
    ),
    field_schema:
      doc.field_schema ||
      [],
    fieldSchema:
      doc.field_schema ||
      [],
    sourceLabel:
      doc.source_label ||
      "document.pdf",
    docTitle:
      doc.doc_title,
    industryLabel:
      doc.industry_label,
    createdAt:
      doc.created_at,
    updatedAt:
      doc.updated_at,
  }));
}


export async function deleteProcessedDocument(
  documentId: number,
) {
  const response =
    await fetchWithAuth(
      `${API_BASE}/api/documents/${documentId}`,
      {
        method: "DELETE",
      },
    );

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Could not delete the processed document.",
      ),
    );
  }

  return response.json();
}


export async function deleteProcessedDocuments(
  documentIds: number[],
) {
  const response =
    await fetchWithAuth(
      `${API_BASE}/api/documents/bulk-delete`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          document_ids:
            documentIds,
        }),
      },
    );

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Could not delete the selected documents.",
      ),
    );
  }

  return response.json();
}


export async function updateProcessedDocument(
  documentId: number,
  extracted: Record<
    string,
    string
  >,
  validation?: any[],
  overall?: string,
): Promise<SessionRecord> {
  const response =
    await fetchWithAuth(
      `${API_BASE}/api/documents/${documentId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          extracted,
          validation,
          overall,
        }),
      },
    );

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Could not save document changes.",
      ),
    );
  }

  const doc =
    await response.json();

  return {
    id: String(doc.id),
    document_id: doc.id,
    industry: doc.industry,
    extracted:
      doc.extracted || {},
    validation:
      doc.validation || [],
    overall: doc.overall,
    ai_provider:
      doc.ai_provider ||
      undefined,
    fallback_used:
      Boolean(
        doc.fallback_used,
      ),
    field_schema:
      doc.field_schema ||
      [],
    fieldSchema:
      doc.field_schema ||
      [],
    sourceLabel:
      doc.source_label ||
      "document.pdf",
    docTitle:
      doc.doc_title,
    industryLabel:
      doc.industry_label,
    createdAt:
      doc.created_at,
    updatedAt:
      doc.updated_at,
  };
}


// ============================================================================
// PDF EXPORT
// ============================================================================

export async function exportUpdatedPdf(
  industry: IndustryKey,
  extracted: Record<
    string,
    string
  >,
  fieldSchema?: FieldDefinition[],
): Promise<Blob> {
  const response =
    await fetchWithAuth(
      `${API_BASE}/api/export-pdf`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          industry,
          extracted,
          field_schema:
            fieldSchema || null,
        }),
      },
    );

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Failed to export updated PDF.",
      ),
    );
  }

  return response.blob();
}


export async function exportCombinedPdf(
  records: SessionRecord[],
): Promise<Blob> {
  const response =
    await fetchWithAuth(
      `${API_BASE}/api/export-combined-pdf`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          records:
            records.map(
              (record) => ({
                industry:
                  record.industry,
                extracted:
                  record.extracted,
                sourceLabel:
                  record.sourceLabel,
                fieldSchema:
                  record.fieldSchema ||
                  record.field_schema ||
                  [],
              }),
            ),
        }),
      },
    );

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Failed to export combined PDF.",
      ),
    );
  }

  return response.blob();
}


// ============================================================================
// FIELDS
// ============================================================================

export async function getFields(
  industry: IndustryKey,
) {
  const response =
    await fetchWithAuth(
      `${API_BASE}/api/fields/${industry}`,
    );

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Failed to load fields.",
      ),
    );
  }

  return response.json();
}


export async function createField(
  industry: IndustryKey,
  payload: {
    label: string;
    type: string;
    key?: string;
  },
) {
  const response =
    await fetchWithAuth(
      `${API_BASE}/api/fields/${industry}`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(
          payload,
        ),
      },
    );

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Failed to add field.",
      ),
    );
  }

  return response.json();
}


export async function updateField(
  industry: IndustryKey,
  fieldId: number,
  payload: {
    label: string;
    type: string;
  },
) {
  const response =
    await fetchWithAuth(
      `${API_BASE}/api/fields/${industry}/${fieldId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(
          payload,
        ),
      },
    );

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Failed to update field.",
      ),
    );
  }

  return response.json();
}


export async function deleteField(
  industry: IndustryKey,
  fieldId: number,
) {
  const response =
    await fetchWithAuth(
      `${API_BASE}/api/fields/${industry}/${fieldId}`,
      {
        method: "DELETE",
      },
    );

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Failed to remove field.",
      ),
    );
  }

  return response.json();
}


// ============================================================================
// EMAIL
// ============================================================================

export async function emailPdf(
  industry: IndustryKey,
  extracted: Record<
    string,
    string
  >,
  recipient: string,
  filename?: string,
  fieldSchema?: FieldDefinition[],
) {
  const response =
    await fetchWithAuth(
      `${API_BASE}/api/email-pdf`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          industry,
          extracted,
          recipient,
          filename:
            filename ||
            `${industry}_updated.pdf`,
          field_schema:
            fieldSchema || null,
        }),
      },
    );

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Failed to send PDF email.",
      ),
    );
  }

  return response.json();
}


export async function emailUpdatedPdf(
  industry: IndustryKey,
  extracted: Record<
    string,
    string
  >,
  recipient: string,
  fieldSchema?: FieldDefinition[],
) {
  return emailPdf(
    industry,
    extracted,
    recipient,
    `${industry}_updated.pdf`,
    fieldSchema,
  );
}


export async function emailCombinedPdf(
  records: SessionRecord[],
  recipient: string,
) {
  const response =
    await fetchWithAuth(
      `${API_BASE}/api/email-combined-pdf`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          records:
            records.map(
              (record) => ({
                industry:
                  record.industry,
                extracted:
                  record.extracted,
                sourceLabel:
                  record.sourceLabel,
                fieldSchema:
                  record.fieldSchema ||
                  record.field_schema ||
                  [],
              }),
            ),
          recipient,
        }),
      },
    );

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Failed to send combined PDF email.",
      ),
    );
  }

  return response.json();
}