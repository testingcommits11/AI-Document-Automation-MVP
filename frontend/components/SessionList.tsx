"use client";

import { useState } from "react";
import { SessionRecord } from "@/lib/types";
import {
  exportCombinedPdf,
  exportUpdatedPdf,
  emailPdf,
  emailCombinedPdf,
  deleteProcessedDocument,
} from "@/lib/api";
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function SessionList({
  records,
  onDelete,
}: {
  records: SessionRecord[];
  onDelete: (documentId: number) => Promise<void> | void;
}) {
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [emailOpenId, setEmailOpenId] = useState<string | null>(null);
  const [emailAddress, setEmailAddress] = useState("");
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [emailAllOpen, setEmailAllOpen] = useState(false);
  const [emailAllAddress, setEmailAllAddress] = useState("");
  const [sendingEmailAll, setSendingEmailAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDownloadAll() {
    setError(null);
    setEmailSuccess(null);
    setDownloadingAll(true);
    try {
      const blob = await exportCombinedPdf(records);
      downloadBlob(blob, "processed_documents_combined.pdf");
    } catch (e: any) {
      setError(e.message || "Failed to download combined PDF.");
    } finally {
      setDownloadingAll(false);
    }
  }

  async function handleDownloadOne(r: SessionRecord) {
    setError(null);
    setEmailSuccess(null);
    setDownloadingId(r.id);
    try {
      const blob = await exportUpdatedPdf(r.industry, r.extracted, r.fieldSchema || r.field_schema || []);
      downloadBlob(blob, `${r.industry}_${r.id}.pdf`);
    } catch (e: any) {
      setError(e.message || "Failed to download PDF.");
    } finally {
      setDownloadingId(null);
    }
  }

  function handleOpenEmail(r: SessionRecord) {
    setError(null);
    setEmailSuccess(null);
    setEmailOpenId(emailOpenId === r.id ? null : r.id);
    setEmailAddress("");
    setEmailAllOpen(false);
    setEmailAllAddress("");
  }

  async function handleSendEmail(r: SessionRecord) {
    const recipient = emailAddress.trim();
    if (!recipient) return setError("Please enter a recipient email address.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return setError("Please enter a valid email address.");

    setError(null);
    setEmailSuccess(null);
    setSendingEmailId(r.id);
    try {
      await emailPdf(r.industry, r.extracted, recipient, `${r.industry}_${r.id}.pdf`, r.fieldSchema || r.field_schema || []);
      setEmailSuccess(`PDF sent successfully to ${recipient}.`);
      setEmailAddress("");
      setEmailOpenId(null);
    } catch (e: any) {
      setError(e.message || "Failed to send PDF by email.");
    } finally {
      setSendingEmailId(null);
    }
  }

  async function handleDelete(r: SessionRecord) {
    const documentId = r.document_id ?? Number(r.id);

    if (!documentId || Number.isNaN(documentId)) {
      setError("Could not determine the document ID.");
      return;
    }

    const confirmed = window.confirm(
      `Delete \"${r.docTitle}\" from your processed documents? This cannot be undone.`,
    );

    if (!confirmed) return;

    setError(null);
    setEmailSuccess(null);
    setDeletingId(r.id);

    try {
      await deleteProcessedDocument(documentId);
      await onDelete(documentId);
      setEmailOpenId(null);
      setEmailAddress("");
    } catch (e: any) {
      setError(
        e?.message ||
          "Failed to delete processed document.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function handleEmailAll() {
    const recipient = emailAllAddress.trim();
    if (!recipient) return setError("Please enter a recipient email address.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return setError("Please enter a valid email address.");

    setError(null);
    setEmailSuccess(null);
    setSendingEmailAll(true);
    try {
      await emailCombinedPdf(records, recipient);
      setEmailSuccess(`Combined PDF sent successfully to ${recipient}.`);
      setEmailAllAddress("");
      setEmailAllOpen(false);
    } catch (e: any) {
      setError(e.message || "Failed to send combined PDF by email.");
    } finally {
      setSendingEmailAll(false);
    }
  }

  return (
    <div className="mt-14">
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <h3 className="font-display font-semibold text-lg text-ink">Processed Documents</h3>
        {records.length > 0 && <span className="bg-primarysoft text-primary text-xs font-semibold px-2.5 py-0.5 rounded-full">{records.length}</span>}
        {records.length > 0 && (
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <button type="button" onClick={handleDownloadAll} disabled={downloadingAll || sendingEmailAll} className="bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 disabled:opacity-50">
              {downloadingAll ? "Generating…" : "Download All (Combined PDF)"}
            </button>
            <button type="button" onClick={() => { setEmailAllOpen((v) => !v); setEmailOpenId(null); setEmailAddress(""); }} disabled={sendingEmailAll || downloadingAll} className="border border-line bg-white text-ink hover:border-primary hover:text-primary font-medium text-xs px-4 py-2.5 rounded-lg disabled:opacity-50">
              Email All
            </button>
          </div>
        )}
      </div>

      <p className="font-mono text-[11px] text-inksoft mb-5">Your processed documents are saved to your account and remain available after refresh.</p>

      {emailAllOpen && records.length > 0 && (
        <div className="mb-5 rounded-xl border border-line bg-white p-4 shadow-card">
          <div className="flex flex-col sm:flex-row gap-2">
            <input type="email" value={emailAllAddress} onChange={(e) => setEmailAllAddress(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleEmailAll(); } }} placeholder="Enter recipient email address" disabled={sendingEmailAll} className="flex-1 min-w-0 border border-line rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary" />
            <button type="button" onClick={handleEmailAll} disabled={sendingEmailAll || !emailAllAddress.trim()} className="bg-primary text-white rounded-lg px-5 py-2.5 font-semibold disabled:opacity-50">{sendingEmailAll ? "Sending…" : "Send All"}</button>
          </div>
        </div>
      )}

      {error && <div className="text-xs text-red-500 font-mono mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5">{error}</div>}
      {emailSuccess && <div className="text-xs text-emerald-600 font-mono mb-4 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2.5">{emailSuccess}</div>}

      {records.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl">
          <p className="text-inksoft text-sm">No processed documents yet</p>
          <p className="text-slate-400 text-xs mt-1">Processed documents will remain here after page refresh.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((r, i) => {
            const good = r.overall === "ready";
            const emailOpen = emailOpenId === r.id;
            const sendingEmail = sendingEmailId === r.id;
            const downloading = downloadingId === r.id;

            return (
              <div key={r.id} className="card-lift bg-white border border-line/70 rounded-xl px-5 py-4 shadow-card">
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-xs font-mono text-slate-400">#{records.length - i}</span>
                      <span className="text-xs text-slate-300">·</span>
                      <span className="text-sm font-medium text-ink truncate">{r.industryLabel}</span>
                      <span className="text-xs text-slate-300">·</span>
                      <span className="text-xs text-inksoft truncate">{r.docTitle}</span>
                    </div>
                    <div className="text-xs text-inksoft leading-relaxed truncate">
                      {r.validation.map((f) => `${f.label}: ${f.value || "—"}`).join(" · ")}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${good ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                      {good ? "Valid" : "Review"}
                    </span>
                    <button type="button" onClick={() => handleDownloadOne(r)} disabled={downloading || sendingEmail} title="Download PDF" className="w-9 h-9 rounded-lg border border-line bg-white text-inksoft hover:border-primary hover:text-primary flex items-center justify-center disabled:opacity-50">
                      {downloading ? <div className="w-4 h-4 border-2 border-slate-300 border-t-primary rounded-full animate-spin" /> : "↓"}
                    </button>
                    <button type="button" onClick={() => handleOpenEmail(r)} disabled={sendingEmail || downloading} title="Email PDF" className={`w-9 h-9 rounded-lg border flex items-center justify-center disabled:opacity-50 ${emailOpen ? "border-primary bg-primary/5 text-primary" : "border-line bg-white text-inksoft hover:border-primary hover:text-primary"}`}>
                      @
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(r)}
                      disabled={
                        deletingId === r.id ||
                        downloading ||
                        sendingEmail
                      }
                      title="Delete processed document"
                      aria-label={`Delete ${r.docTitle}`}
                      className="w-9 h-9 rounded-lg border border-red-200 bg-white text-red-500 hover:bg-red-50 hover:border-red-300 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deletingId === r.id ? (
                        <div className="w-4 h-4 border-2 border-red-200 border-t-red-500 rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12m-9 0v10m6-10v10M9 7l1-3h4l1 3m-8 0h10" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {emailOpen && (
                  <div className="mt-4 pt-4 border-t border-line/70">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input type="email" value={emailAddress} onChange={(e) => setEmailAddress(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSendEmail(r); } }} placeholder="Enter recipient email address" disabled={sendingEmail} autoFocus className="flex-1 min-w-0 border border-line rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary" />
                      <button type="button" onClick={() => handleSendEmail(r)} disabled={sendingEmail || !emailAddress.trim()} className="bg-primary text-white rounded-lg px-5 py-2.5 font-semibold disabled:opacity-50">{sendingEmail ? "Sending…" : "Send PDF"}</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}