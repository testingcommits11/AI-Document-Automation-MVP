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
).replace(
  /\/+$/,
  "",
);


// ============================================================================
// AUTH HEADERS
// ============================================================================

function authHeaders(): HeadersInit {
  const token =
    getAuthToken();

  return token
    ? {
        Authorization:
          `Bearer ${token}`,
      }
    : {};
}


// ============================================================================
// ERROR HANDLING
// ============================================================================

async function readError(
  response: Response,
  fallback: string,
): Promise<string> {
  const body =
    await response
      .json()
      .catch(
        () => ({}),
      );

  return (
    body.detail ||
    body.message ||
    fallback
  );
}


// ============================================================================
// INDUSTRIES
// ============================================================================

export async function fetchIndustries():
  Promise<
    Record<
      IndustryKey,
      IndustryMeta
    >
  > {
  const response =
    await fetch(
      `${API_BASE}/api/industries`,
      {
        headers: {
          ...authHeaders(),
        },
      },
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
  return (
    `${API_BASE}/api/demo/${industry}` +
    (
      negative
        ? "?negative=true"
        : ""
    )
  );
}


export async function fetchDemoPdf(
  industry: IndustryKey,
  negative = false,
): Promise<Blob> {
  const response =
    await fetch(
      demoPdfUrl(
        industry,
        negative,
      ),
      {
        headers: {
          ...authHeaders(),
        },
      },
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
    await fetch(
      `${API_BASE}/api/process`,
      {
        method: "POST",
        headers: {
          ...authHeaders(),
        },
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

export async function fetchDocuments():
  Promise<SessionRecord[]> {
  const response =
    await fetch(
      `${API_BASE}/api/documents`,
      {
        headers: {
          ...authHeaders(),
        },
      },
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
  ).map(
    (
      doc: any,
    ) => ({
      id: String(
        doc.id,
      ),

      document_id:
        Number(
          doc.id,
        ),

      industry:
        doc.industry,

      extracted:
        doc.extracted ||
        {},

      validation:
        doc.validation ||
        [],

      overall:
        doc.overall,

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
    }),
  );
}


export async function deleteProcessedDocument(
  documentId: number,
): Promise<{
  ok: boolean;
  document_id: number;
}> {
  const response =
    await fetch(
      `${API_BASE}/api/documents/${documentId}`,
      {
        method: "DELETE",
        headers: {
          ...authHeaders(),
        },
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
    await fetch(
      `${API_BASE}/api/documents/${documentId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type":
            "application/json",
          ...authHeaders(),
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
    id: String(
      doc.id,
    ),

    document_id:
      Number(
        doc.id,
      ),

    industry:
      doc.industry,

    extracted:
      doc.extracted ||
      {},

    validation:
      doc.validation ||
      [],

    overall:
      doc.overall,

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
// SINGLE PDF EXPORT
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
    await fetch(
      `${API_BASE}/api/export-pdf`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          industry,
          extracted,
          field_schema:
            fieldSchema ||
            null,
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


// ============================================================================
// COMBINED PDF
// ============================================================================

export async function exportCombinedPdf(
  records: SessionRecord[],
): Promise<Blob> {
  const response =
    await fetch(
      `${API_BASE}/api/export-combined-pdf`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          ...authHeaders(),
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
    await fetch(
      `${API_BASE}/api/fields/${industry}`,
      {
        headers: {
          ...authHeaders(),
        },
      },
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
    await fetch(
      `${API_BASE}/api/fields/${industry}`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          ...authHeaders(),
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
    await fetch(
      `${API_BASE}/api/fields/${industry}/${fieldId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type":
            "application/json",
          ...authHeaders(),
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
    await fetch(
      `${API_BASE}/api/fields/${industry}/${fieldId}`,
      {
        method: "DELETE",
        headers: {
          ...authHeaders(),
        },
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
// EMAIL SINGLE
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
): Promise<{
  ok: boolean;
  message: string;
}> {
  const response =
    await fetch(
      `${API_BASE}/api/email-pdf`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          industry,
          extracted,
          recipient,
          filename:
            filename ||
            `${industry}_updated.pdf`,
          field_schema:
            fieldSchema ||
            null,
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
): Promise<{
  ok: boolean;
  message: string;
}> {
  return emailPdf(
    industry,
    extracted,
    recipient,
    `${industry}_updated.pdf`,
    fieldSchema,
  );
}


// ============================================================================
// EMAIL ALL
// ============================================================================

export async function emailCombinedPdf(
  records: SessionRecord[],
  recipient: string,
): Promise<{
  ok: boolean;
  message: string;
}> {
  const response =
    await fetch(
      `${API_BASE}/api/email-combined-pdf`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          ...authHeaders(),
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


// ============================================================================
// REGISTER
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

  // Backend provides expires_in,
  // but the client does not need to
  // enforce the expiry itself.
  setAuthToken(
    body.access_token,
  );

  return body;
}


// ============================================================================
// LOGIN
// ============================================================================

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


// ============================================================================
// CURRENT USER
// ============================================================================

export async function fetchCurrentUser() {
  const response =
    await fetch(
      `${API_BASE}/api/auth/me`,
      {
        headers: {
          ...authHeaders(),
        },
      },
    );

  // ONLY clear the token when
  // the backend explicitly returns 401.
  if (
    response.status ===
    401
  ) {
    clearAuthToken();

    return null;
  }

  // Do NOT clear the token for
  // 500, 502, network issues, etc.
  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Could not verify authentication session.",
      ),
    );
  }

  return response.json();
}


// ============================================================================
// LOGOUT
// ============================================================================

export function logout() {
  clearAuthToken();
}