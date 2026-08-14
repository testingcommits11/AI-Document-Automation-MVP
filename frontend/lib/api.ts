import {
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
).replace(
  /\/+$/,
  "",
);


function authHeaders(): HeadersInit {
  const token =
    getAuthToken();

  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
}


// ============================================================================
// INDUSTRIES
// ============================================================================

export async function fetchIndustries(): Promise<
  Record<IndustryKey, IndustryMeta>
> {
  const res = await fetch(
    `${API_BASE}/api/industries`,
    {
      headers: {
        ...authHeaders(),
      },
    },
  );

  if (!res.ok) {
    throw new Error(
      "Could not load industry configuration from the API.",
    );
  }

  return res.json();
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
  const res = await fetch(
    demoPdfUrl(
      industry,
      negative,
    ),
  );

  if (!res.ok) {
    throw new Error(
      "Could not load the demo PDF.",
    );
  }

  return res.blob();
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

  const res = await fetch(
    `${API_BASE}/api/process`,
    {
      method: "POST",
      headers: {
        ...authHeaders(),
      },
      body: form,
    },
  );

  if (!res.ok) {
    const body =
      await res
        .json()
        .catch(
          () => ({
            detail:
              "Processing failed.",
          }),
        );

    throw new Error(
      body.detail ||
        "Processing failed.",
    );
  }

  return res.json();
}


// ============================================================================
// SINGLE PDF
// ============================================================================

export async function exportUpdatedPdf(
  industry: IndustryKey,
  extracted: Record<string, string>,
): Promise<Blob> {
  const res = await fetch(
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
      }),
    },
  );

  if (!res.ok) {
    const body =
      await res
        .json()
        .catch(
          () => ({
            detail:
              "Failed to export updated PDF.",
          }),
        );

    throw new Error(
      body.detail ||
        "Failed to export updated PDF.",
    );
  }

  return res.blob();
}


// ============================================================================
// COMBINED PDF
// ============================================================================

export async function exportCombinedPdf(
  records: SessionRecord[],
): Promise<Blob> {
  const res = await fetch(
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
            }),
          ),
      }),
    },
  );

  if (!res.ok) {
    const body =
      await res
        .json()
        .catch(
          () => ({
            detail:
              "Failed to export combined PDF.",
          }),
        );

    throw new Error(
      body.detail ||
        "Failed to export combined PDF.",
    );
  }

  return res.blob();
}


// ============================================================================
// FIELDS
// ============================================================================

export async function getFields(
  industry: IndustryKey,
) {
  const res = await fetch(
    `${API_BASE}/api/fields/${industry}`,
    {
      headers: {
        ...authHeaders(),
      },
    },
  );

  const body =
    await res
      .json()
      .catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      body.detail ||
        "Failed to load fields.",
    );
  }

  return body;
}


export async function createField(
  industry: IndustryKey,
  payload: {
    label: string;
    type: string;
    key?: string;
  },
) {
  const res = await fetch(
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

  const body =
    await res
      .json()
      .catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      body.detail ||
        "Failed to add field.",
    );
  }

  return body;
}


export async function updateField(
  industry: IndustryKey,
  fieldId: number,
  payload: {
    label: string;
    type: string;
  },
) {
  const res = await fetch(
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

  const body =
    await res
      .json()
      .catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      body.detail ||
        "Failed to update field.",
    );
  }

  return body;
}


export async function deleteField(
  industry: IndustryKey,
  fieldId: number,
) {
  const res = await fetch(
    `${API_BASE}/api/fields/${industry}/${fieldId}`,
    {
      method: "DELETE",
      headers: {
        ...authHeaders(),
      },
    },
  );

  const body =
    await res
      .json()
      .catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      body.detail ||
        "Failed to remove field.",
    );
  }

  return body;
}


// ============================================================================
// EMAIL SINGLE
// ============================================================================

export async function emailPdf(
  industry: IndustryKey,
  extracted: Record<string, string>,
  recipient: string,
  filename?: string,
): Promise<{
  ok: boolean;
  message: string;
}> {
  const res = await fetch(
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
      }),
    },
  );

  const body =
    await res
      .json()
      .catch(
        () => ({
          detail:
            "Failed to send PDF email.",
        }),
      );

  if (!res.ok) {
    throw new Error(
      body.detail ||
        body.message ||
        `Email request failed with status ${res.status}.`,
    );
  }

  return body;
}


export async function emailUpdatedPdf(
  industry: IndustryKey,
  extracted: Record<string, string>,
  recipient: string,
): Promise<{
  ok: boolean;
  message: string;
}> {
  return emailPdf(
    industry,
    extracted,
    recipient,
    `${industry}_updated.pdf`,
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
  const res = await fetch(
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
            }),
          ),
        recipient,
      }),
    },
  );

  const body =
    await res
      .json()
      .catch(
        () => ({
          detail:
            "Failed to send combined PDF email.",
        }),
      );

  if (!res.ok) {
    throw new Error(
      body.detail ||
        body.message ||
        `Email request failed with status ${res.status}.`,
    );
  }

  return body;
}


// ============================================================================
// AUTH
// ============================================================================

export async function register(
  email: string,
  password: string,
) {
  const res = await fetch(
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

  const body =
    await res
      .json()
      .catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      body.detail ||
        "Registration failed.",
    );
  }

  setAuthToken(
    body.access_token,
  );

  return body;
}


export async function login(
  email: string,
  password: string,
) {
  const res = await fetch(
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

  const body =
    await res
      .json()
      .catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      body.detail ||
        "Login failed.",
    );
  }

  setAuthToken(
    body.access_token,
  );

  return body;
}


export async function fetchCurrentUser() {
  const res = await fetch(
    `${API_BASE}/api/auth/me`,
    {
      headers: {
        ...authHeaders(),
      },
    },
  );

  if (!res.ok) {
    clearAuthToken();
    return null;
  }

  return res.json();
}


export function logout() {
  clearAuthToken();
}