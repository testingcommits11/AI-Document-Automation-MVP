const TOKEN_KEY =
  "ai_document_auth_token";

const TOKEN_EXPIRES_KEY =
  "ai_document_auth_expires_at";


function isExpired(
  expiresAt: string | null,
): boolean {
  if (!expiresAt) {
    return false;
  }

  const timestamp =
    Number(expiresAt);

  if (
    !Number.isFinite(timestamp)
  ) {
    return true;
  }

  return (
    Date.now() >= timestamp
  );
}


export function getAuthToken():
  string | null {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  const token =
    localStorage.getItem(
      TOKEN_KEY,
    );

  if (!token) {
    return null;
  }

  const expiresAt =
    localStorage.getItem(
      TOKEN_EXPIRES_KEY,
    );

  if (
    isExpired(expiresAt)
  ) {
    clearAuthToken();

    return null;
  }

  return token;
}


export function setAuthToken(
  token: string,
  expiresInSeconds?: number,
): void {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  localStorage.setItem(
    TOKEN_KEY,
    token,
  );

  if (
    expiresInSeconds &&
    expiresInSeconds > 0
  ) {
    const expiresAt =
      Date.now() +
      expiresInSeconds *
        1000;

    localStorage.setItem(
      TOKEN_EXPIRES_KEY,
      String(expiresAt),
    );
  } else {
    localStorage.removeItem(
      TOKEN_EXPIRES_KEY,
    );
  }
}


export function clearAuthToken(): void {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  localStorage.removeItem(
    TOKEN_KEY,
  );

  localStorage.removeItem(
    TOKEN_EXPIRES_KEY,
  );
}


export function getAuthExpiresAt():
  number | null {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  const value =
    localStorage.getItem(
      TOKEN_EXPIRES_KEY,
    );

  if (!value) {
    return null;
  }

  const timestamp =
    Number(value);

  return Number.isFinite(
    timestamp,
  )
    ? timestamp
    : null;
}


export function getSecondsUntilExpiry():
  number | null {
  const expiresAt =
    getAuthExpiresAt();

  if (expiresAt === null) {
    return null;
  }

  return Math.max(
    0,
    Math.floor(
      (
        expiresAt -
        Date.now()
      ) / 1000,
    ),
  );
}