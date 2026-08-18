"use client";

import { useState } from "react";
import { login, register } from "@/lib/api";

export default function LoginModal({
  onAuthenticated,
  onClose,
  required = false,
}: {
  onAuthenticated: () => Promise<void> | void;
  onClose: () => void;
  required?: boolean;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!email.trim()) return setError("Email is required.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (mode === "register" && password !== confirmPassword) return setError("Passwords do not match.");

    setBusy(true);
    try {
      if (mode === "login") await login(email.trim(), password);
      else await register(email.trim(), password);
      await onAuthenticated();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-line p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="font-display font-semibold text-xl text-ink">
              {mode === "login" ? "Login to continue" : "Create your account"}
            </h2>
            <p className="text-inksoft text-sm mt-1">
              {required
                ? "Login is required to use the document automation system. Your processed documents are saved to your account."
                : "Use your account to manage custom fields and saved documents."}
            </p>
          </div>

          {!required && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg border border-line text-inksoft hover:border-primary hover:text-primary"
            >
              ×
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full border border-line rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimum 8 characters"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="w-full border border-line rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </div>

          {mode === "register" && (
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat password"
                autoComplete="new-password"
                className="w-full border border-line rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </div>
          )}

          {error && <div className="rounded-xl border border-red-100 bg-red-50 text-red-600 px-3 py-2.5 text-sm">{error}</div>}

          <button type="submit" disabled={busy} className="w-full bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl py-3 disabled:opacity-50">
            {busy ? "Please wait..." : mode === "login" ? "Login" : "Create Account"}
          </button>
        </form>

        <div className="text-center mt-5 text-sm text-inksoft">
          {mode === "login" ? (
            <>Don't have an account? <button type="button" onClick={() => { setMode("register"); setError(null); }} className="text-primary font-semibold hover:underline">Create one</button></>
          ) : (
            <>Already have an account? <button type="button" onClick={() => { setMode("login"); setError(null); }} className="text-primary font-semibold hover:underline">Login</button></>
          )}
        </div>
      </div>
    </div>
  );
}