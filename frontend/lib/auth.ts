const TOKEN_KEY = "ai_document_auth_token";

type AuthExpiredHandler = () => void;

let expirationTimer: ReturnType<typeof setTimeout> | null = null;

function getTokenPayload(token: string): {
  exp?: number;
} | null {
  try {
    const parts = token.split(".");

    if (parts.length !== 3) {
      return null;
    }

    const base64 = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const padded = base64.padEnd(
      Math.ceil(base64.length / 4) * 4,
      "=",
    );

    return JSON.parse(
      atob(padded),
    );
  } catch {
    return null;
  }
}

function scheduleTokenExpiration(
  token: string,
) {
  if (typeof window === "undefined") {
    return;
  }

  if (expirationTimer) {
    clearTimeout(expirationTimer);
    expirationTimer = null;
  }

  const payload =
    getTokenPayload(token);

  if (!payload?.exp) {
    return;
  }

  const expiresAt =
    payload.exp * 1000;

  const delay =
    expiresAt - Date.now();

  if (delay <= 0) {
    clearAuthToken();
    return;
  }

  expirationTimer =
    setTimeout(() => {
      clearAuthToken();

      window.dispatchEvent(
        new Event("auth-expired"),
      );
    }, delay);
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem(
    TOKEN_KEY,
  );
}

export function setAuthToken(
  token: string,
): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(
    TOKEN_KEY,
    token,
  );

  scheduleTokenExpiration(
    token,
  );
}

export function clearAuthToken(): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(
    TOKEN_KEY,
  );

  if (expirationTimer) {
    clearTimeout(
      expirationTimer,
    );

    expirationTimer = null;
  }
}

export function initializeAuthExpiration(
  onExpired?: AuthExpiredHandler,
): void {
  if (typeof window === "undefined") {
    return;
  }

  const token =
    getAuthToken();

  if (!token) {
    return;
  }

  const payload =
    getTokenPayload(token);

  if (!payload?.exp) {
    return;
  }

  const expiresAt =
    payload.exp * 1000;

  const delay =
    expiresAt - Date.now();

  if (delay <= 0) {
    clearAuthToken();

    onExpired?.();

    return;
  }

  if (expirationTimer) {
    clearTimeout(
      expirationTimer,
    );
  }

  expirationTimer =
    setTimeout(() => {
      clearAuthToken();

      window.dispatchEvent(
        new Event("auth-expired"),
      );

      onExpired?.();
    }, delay);
}