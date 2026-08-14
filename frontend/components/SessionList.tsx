"use client";

import { useState } from "react";
import { SessionRecord } from "@/lib/types";
import {
  exportCombinedPdf,
  exportUpdatedPdf,
  emailPdf,
  emailCombinedPdf,
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
}: {
  records: SessionRecord[];
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

  async function handleDownloadAll() {
    setError(null);
    setEmailSuccess(null);
    setDownloadingAll(true);

    try {
      const blob = await exportCombinedPdf(records);

      downloadBlob(
        blob,
        "processed_documents_combined.pdf",
      );
    } catch (e: any) {
      setError(
        e.message ||
          "Failed to download combined PDF.",
      );
    } finally {
      setDownloadingAll(false);
    }
  }

  async function handleDownloadOne(
    r: SessionRecord,
  ) {
    setError(null);
    setEmailSuccess(null);
    setDownloadingId(r.id);

    try {
      const blob = await exportUpdatedPdf(
        r.industry,
        r.extracted,
      );

      downloadBlob(
        blob,
        `${r.industry}_${r.id}.pdf`,
      );
    } catch (e: any) {
      setError(
        e.message || "Failed to download PDF.",
      );
    } finally {
      setDownloadingId(null);
    }
  }

  function handleOpenEmail(
    r: SessionRecord,
  ) {
    setError(null);
    setEmailSuccess(null);

    if (emailOpenId === r.id) {
      setEmailOpenId(null);
      setEmailAddress("");
      return;
    }

    setEmailOpenId(r.id);
    setEmailAddress("");

    // Close "Email All" when opening an individual email.
    setEmailAllOpen(false);
    setEmailAllAddress("");
  }

  async function handleSendEmail(
    r: SessionRecord,
  ) {
    const recipient = emailAddress.trim();

    if (!recipient) {
      setError(
        "Please enter a recipient email address.",
      );
      return;
    }

    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(recipient)) {
      setError(
        "Please enter a valid email address.",
      );
      return;
    }

    setError(null);
    setEmailSuccess(null);
    setSendingEmailId(r.id);

    try {
      await emailPdf(
        r.industry,
        r.extracted,
        recipient,
        `${r.industry}_${r.id}.pdf`,
      );

      setEmailSuccess(
        `PDF sent successfully to ${recipient}.`,
      );

      setEmailAddress("");
      setEmailOpenId(null);
    } catch (e: any) {
      setError(
        e.message ||
          "Failed to send PDF by email.",
      );
    } finally {
      setSendingEmailId(null);
    }
  }

  function handleToggleEmailAll() {
    setError(null);
    setEmailSuccess(null);

    if (emailAllOpen) {
      setEmailAllOpen(false);
      setEmailAllAddress("");
      return;
    }

    // Close any individual email panel.
    setEmailOpenId(null);
    setEmailAddress("");

    setEmailAllOpen(true);
  }

  async function handleEmailAll() {
    const recipient =
      emailAllAddress.trim();

    if (!recipient) {
      setError(
        "Please enter a recipient email address.",
      );
      return;
    }

    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(recipient)) {
      setError(
        "Please enter a valid email address.",
      );
      return;
    }

    if (!records.length) {
      setError(
        "There are no processed documents to email.",
      );
      return;
    }

    setError(null);
    setEmailSuccess(null);
    setSendingEmailAll(true);

    try {
      await emailCombinedPdf(
        records,
        recipient,
      );

      setEmailSuccess(
        `Combined PDF sent successfully to ${recipient}.`,
      );

      setEmailAllAddress("");
      setEmailAllOpen(false);
    } catch (e: any) {
      setError(
        e.message ||
          "Failed to send combined PDF by email.",
      );
    } finally {
      setSendingEmailAll(false);
    }
  }

  return (
    <div className="mt-14">
      {/* =========================================================
          HEADER
      ========================================================= */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <h3 className="font-display font-semibold text-lg text-ink">
          Processed Documents
        </h3>

        {records.length > 0 && (
          <span className="bg-primarysoft text-primary text-xs font-semibold px-2.5 py-0.5 rounded-full">
            {records.length}
          </span>
        )}

        {records.length > 0 && (
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {/* =====================================================
                DOWNLOAD ALL
            ===================================================== */}
            <button
              type="button"
              onClick={handleDownloadAll}
              disabled={
                downloadingAll ||
                sendingEmailAll
              }
              title="Download all processed documents"
              className="bg-slate-900 hover:bg-slate-800 active:bg-black text-white font-medium text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloadingAll ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg
                  className="w-3.5 h-3.5 text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3v12"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7 10l5 5 5-5"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 21h14"
                  />
                </svg>
              )}

              {downloadingAll
                ? "Generating…"
                : "Download All (Combined PDF)"}
            </button>

            {/* =====================================================
                EMAIL ALL
            ===================================================== */}
            <button
              type="button"
              onClick={handleToggleEmailAll}
              disabled={
                sendingEmailAll ||
                downloadingAll
              }
              title="Email all processed documents"
              className={`font-medium text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                emailAllOpen
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-line bg-white text-ink hover:border-primary hover:text-primary"
              }`}
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <rect
                  x="3"
                  y="5"
                  width="18"
                  height="14"
                  rx="2"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m3 7 9 6 9-6"
                />
              </svg>

              Email All
            </button>
          </div>
        )}
      </div>

      {/* =========================================================
          SESSION DESCRIPTION
      ========================================================= */}
      <p className="font-mono text-[11px] text-inksoft mb-5">
        Kept only for this page session — refreshing
        clears this list. No database, no persistence.
      </p>

      {/* =========================================================
          EMAIL ALL PANEL
      ========================================================= */}
      {records.length > 0 &&
        emailAllOpen && (
          <div className="mb-5 rounded-xl border border-line bg-white p-4 shadow-card animate-fade-in">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={emailAllAddress}
                onChange={(e) =>
                  setEmailAllAddress(
                    e.target.value,
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleEmailAll();
                  }
                }}
                placeholder="Enter recipient email address"
                disabled={sendingEmailAll}
                autoFocus
                className="flex-1 min-w-0 border border-line rounded-lg px-3 py-2.5 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:bg-slate-50"
              />

              <button
                type="button"
                onClick={handleEmailAll}
                disabled={
                  sendingEmailAll ||
                  !emailAllAddress.trim()
                }
                className="bg-primary hover:bg-primary/90 active:bg-primary/80 text-white font-semibold text-sm px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingEmailAll ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M22 2L11 13"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M22 2l-7 20-4-9-9-4 20-7z"
                      />
                    </svg>

                    Send All
                  </>
                )}
              </button>
            </div>

            <p className="text-[10px] text-inksoft font-mono mt-2">
              All {records.length} processed documents
              will be included in one combined PDF
              attachment.
            </p>
          </div>
        )}

      {/* =========================================================
          ERROR
      ========================================================= */}
      {error && (
        <div className="text-xs text-red-500 font-mono mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5">
          {error}
        </div>
      )}

      {/* =========================================================
          SUCCESS
      ========================================================= */}
      {emailSuccess && (
        <div className="text-xs text-emerald-600 font-mono mb-4 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2.5">
          {emailSuccess}
        </div>
      )}

      {/* =========================================================
          EMPTY STATE
      ========================================================= */}
      {records.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <svg
              className="w-6 h-6 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>

          <p className="text-inksoft text-sm">
            Nothing processed yet this session
          </p>

          <p className="text-slate-400 text-xs mt-1">
            Documents will appear here after
            processing
          </p>
        </div>
      ) : (
        /* =======================================================
           DOCUMENT LIST
        ======================================================= */
        <div className="space-y-3">
          {records.map((r, i) => {
            const good = r.overall === "ready";
            const emailOpen =
              emailOpenId === r.id;
            const sendingEmail =
              sendingEmailId === r.id;
            const downloading =
              downloadingId === r.id;

            return (
              <div
                key={r.id}
                className="card-lift bg-white border border-line/70 rounded-xl px-5 py-4 shadow-card animate-fade-in"
              >
                {/* =================================================
                    DOCUMENT HEADER
                ================================================= */}
                <div className="flex justify-between items-start gap-4">
                  {/* Document information */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-xs font-mono text-slate-400">
                        #{records.length - i}
                      </span>

                      <span className="text-xs text-slate-300">
                        ·
                      </span>

                      <span className="text-sm font-medium text-ink truncate">
                        {r.industryLabel}
                      </span>

                      <span className="text-xs text-slate-300">
                        ·
                      </span>

                      <span className="text-xs text-inksoft truncate">
                        {r.docTitle}
                      </span>
                    </div>

                    <div className="text-xs text-inksoft leading-relaxed truncate">
                      {r.validation
                        .map(
                          (f) =>
                            `${f.label}: ${
                              f.value || "—"
                            }`,
                        )
                        .join(" · ")}
                    </div>
                  </div>

                  {/* =================================================
                      DOCUMENT ACTIONS
                  ================================================= */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Status */}
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap px-3 py-1.5 rounded-full ${
                        good
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-amber-50 text-amber-600"
                      }`}
                    >
                      {good ? (
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 9v2m0 4h.01"
                          />
                        </svg>
                      )}

                      {good ? "Valid" : "Review"}
                    </span>

                    {/* =================================================
                        DOWNLOAD ONE
                    ================================================= */}
                    <button
                      type="button"
                      onClick={() =>
                        handleDownloadOne(r)
                      }
                      disabled={
                        downloading ||
                        sendingEmail
                      }
                      title="Download PDF"
                      aria-label={`Download PDF for ${r.docTitle}`}
                      className="group w-9 h-9 rounded-lg border border-line bg-white text-inksoft hover:border-primary hover:bg-primary/5 hover:text-primary active:bg-primary/10 flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {downloading ? (
                        <div className="w-4 h-4 border-2 border-slate-300 border-t-primary rounded-full animate-spin" />
                      ) : (
                        <svg
                          className="w-4 h-4 transition-transform duration-150 group-hover:translate-y-0.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 3v12"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M7 10l5 5 5-5"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 21h14"
                          />
                        </svg>
                      )}
                    </button>

                    {/* =================================================
                        EMAIL ONE
                    ================================================= */}
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenEmail(r)
                      }
                      disabled={
                        sendingEmail ||
                        downloading
                      }
                      title="Email PDF"
                      aria-label={`Email PDF for ${r.docTitle}`}
                      className={`group w-9 h-9 rounded-lg border flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        emailOpen
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-line bg-white text-inksoft hover:border-primary hover:bg-primary/5 hover:text-primary active:bg-primary/10"
                      }`}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <rect
                          x="3"
                          y="5"
                          width="18"
                          height="14"
                          rx="2"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m3 7 9 6 9-6"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* =================================================
                    INDIVIDUAL EMAIL PANEL
                ================================================= */}
                {emailOpen && (
                  <div className="mt-4 pt-4 border-t border-line/70 animate-fade-in">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="email"
                        value={emailAddress}
                        onChange={(e) =>
                          setEmailAddress(
                            e.target.value,
                          )
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSendEmail(r);
                          }
                        }}
                        placeholder="Enter recipient email address"
                        disabled={sendingEmail}
                        autoFocus
                        className="flex-1 min-w-0 border border-line rounded-lg px-3 py-2.5 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:bg-slate-50"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          handleSendEmail(r)
                        }
                        disabled={
                          sendingEmail ||
                          !emailAddress.trim()
                        }
                        className="bg-primary hover:bg-primary/90 active:bg-primary/80 text-white font-semibold text-sm px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sendingEmail ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Sending…
                          </>
                        ) : (
                          <>
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M22 2L11 13"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M22 2l-7 20-4-9-9-4 20-7z"
                              />
                            </svg>

                            Send PDF
                          </>
                        )}
                      </button>
                    </div>

                    <p className="text-[10px] text-inksoft font-mono mt-2">
                      The generated PDF for this document
                      will be sent as an attachment.
                    </p>
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