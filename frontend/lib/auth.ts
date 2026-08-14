const TOKEN_KEY =
  "ai_document_auth_token";

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
  localStorage.setItem(
    TOKEN_KEY,
    token,
  );
}

export function clearAuthToken(): void {
  localStorage.removeItem(
    TOKEN_KEY,
  );
}