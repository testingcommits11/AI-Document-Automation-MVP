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

function downloadBlob(
  blob: Blob,
  filename: string,
) {
  const url =
    URL.createObjectURL(blob);

  const a =
    document.createElement("a");

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
  onDelete: (
    documentId: number,
  ) => Promise<void> | void;
}) {
  const [
    downloadingAll,
    setDownloadingAll,
  ] = useState(false);

  const [
    downloadingId,
    setDownloadingId,
  ] = useState<string | null>(null);

  const [
    emailOpenId,
    setEmailOpenId,
  ] = useState<string | null>(null);

  const [
    emailAddress,
    setEmailAddress,
  ] = useState("");

  const [
    sendingEmailId,
    setSendingEmailId,
  ] = useState<string | null>(null);

  const [
    emailAllOpen,
    setEmailAllOpen,
  ] = useState(false);

  const [
    emailAllAddress,
    setEmailAllAddress,
  ] = useState("");

  const [
    sendingEmailAll,
    setSendingEmailAll,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  const [
    emailSuccess,
    setEmailSuccess,
  ] = useState<string | null>(null);

  const [
    deletingId,
    setDeletingId,
  ] = useState<string | null>(null);

  async function handleDownloadAll() {
    setError(null);
    setEmailSuccess(null);
    setDownloadingAll(true);

    try {
      const blob =
        await exportCombinedPdf(
          records,
        );

      downloadBlob(
        blob,
        "processed_documents_combined.pdf",
      );
    } catch (e: any) {
      setError(
        e?.message ||
          "Failed to download combined PDF.",
      );
    } finally {
      setDownloadingAll(false);
    }
  }

  async function handleDownloadOne(
    record: SessionRecord,
  ) {
    setError(null);
    setEmailSuccess(null);
    setDownloadingId(record.id);

    try {
      const fieldSchema =
        record.fieldSchema ||
        record.field_schema ||
        [];

      const blob =
        await exportUpdatedPdf(
          record.industry,
          record.extracted,
          fieldSchema,
        );

      downloadBlob(
        blob,
        `${record.industry}_${record.id}.pdf`,
      );
    } catch (e: any) {
      setError(
        e?.message ||
          "Failed to download PDF.",
      );
    } finally {
      setDownloadingId(null);
    }
  }

  function handleOpenEmail(
    record: SessionRecord,
  ) {
    setError(null);
    setEmailSuccess(null);

    setEmailOpenId(
      emailOpenId === record.id
        ? null
        : record.id,
    );

    setEmailAddress("");

    setEmailAllOpen(false);
    setEmailAllAddress("");
  }

  async function handleSendEmail(
    record: SessionRecord,
  ) {
    const recipient =
      emailAddress.trim();

    if (!recipient) {
      setError(
        "Please enter a recipient email address.",
      );
      return;
    }

    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      !emailPattern.test(
        recipient,
      )
    ) {
      setError(
        "Please enter a valid email address.",
      );
      return;
    }

    setError(null);
    setEmailSuccess(null);
    setSendingEmailId(record.id);

    try {
      const fieldSchema =
        record.fieldSchema ||
        record.field_schema ||
        [];

      await emailPdf(
        record.industry,
        record.extracted,
        recipient,
        `${record.industry}_${record.id}.pdf`,
        fieldSchema,
      );

      setEmailSuccess(
        `PDF sent successfully to ${recipient}.`,
      );

      setEmailAddress("");
      setEmailOpenId(null);
    } catch (e: any) {
      setError(
        e?.message ||
          "Failed to send PDF by email.",
      );
    } finally {
      setSendingEmailId(null);
    }
  }

  async function handleDelete(
    record: SessionRecord,
  ) {
    const documentId =
      record.document_id ??
      Number(record.id);

    if (
      !documentId ||
      Number.isNaN(documentId)
    ) {
      setError(
        "Could not determine the document ID.",
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Delete "${record.docTitle}" from your processed documents? This cannot be undone.`,
      );

    if (!confirmed) {
      return;
    }

    setError(null);
    setEmailSuccess(null);
    setDeletingId(record.id);

    try {
      await deleteProcessedDocument(
        documentId,
      );

      await onDelete(
        documentId,
      );

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

    if (
      !emailPattern.test(
        recipient,
      )
    ) {
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
        e?.message ||
          "Failed to send combined PDF by email.",
      );
    } finally {
      setSendingEmailAll(false);
    }
  }

  return (
    <div className="mt-14">
      {/* Header */}
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
            <button
              type="button"
              onClick={handleDownloadAll}
              disabled={
                downloadingAll ||
                sendingEmailAll
              }
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

            <button
              type="button"
              onClick={() => {
                setEmailAllOpen(
                  (value) => !value,
                );

                setEmailOpenId(null);
                setEmailAddress("");
              }}
              disabled={
                sendingEmailAll ||
                downloadingAll
              }
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

      <p className="font-mono text-[11px] text-inksoft mb-5">
        Your processed documents are saved to your account and remain available after refresh.
      </p>

      {/* Email all */}
      {emailAllOpen &&
        records.length > 0 && (
          <div className="mb-5 rounded-xl border border-line bg-white p-4 shadow-card animate-fade-in">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={emailAllAddress}
                onChange={(event) =>
                  setEmailAllAddress(
                    event.target.value,
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key ===
                    "Enter"
                  ) {
                    event.preventDefault();
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
                onClick={
                  handleEmailAll
                }
                disabled={
                  sendingEmailAll ||
                  !emailAllAddress.trim()
                }
                className="bg-primary hover:bg-primary/90 active:bg-primary/80 text-white rounded-lg px-5 py-2.5 font-semibold disabled:opacity-50"
              >
                {sendingEmailAll
                  ? "Sending…"
                  : "Send All"}
              </button>
            </div>

            <p className="text-[10px] text-inksoft font-mono mt-2">
              All {records.length} processed documents will be included in one combined PDF attachment.
            </p>
          </div>
        )}

      {/* Errors */}
      {error && (
        <div className="text-xs text-red-500 font-mono mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5">
          {error}
        </div>
      )}

      {/* Success */}
      {emailSuccess && (
        <div className="text-xs text-emerald-600 font-mono mb-4 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2.5">
          {emailSuccess}
        </div>
      )}

      {/* Empty */}
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
            No processed documents yet
          </p>

          <p className="text-slate-400 text-xs mt-1">
            Processed documents will remain here after page refresh.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map(
            (record, index) => {
              const good =
                record.overall ===
                "ready";

              const emailOpen =
                emailOpenId ===
                record.id;

              const sendingEmail =
                sendingEmailId ===
                record.id;

              const downloading =
                downloadingId ===
                record.id;

              const deleting =
                deletingId ===
                record.id;

              return (
                <div
                  key={record.id}
                  className="card-lift bg-white border border-line/70 rounded-xl px-5 py-4 shadow-card animate-fade-in"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-xs font-mono text-slate-400">
                          #{records.length - index}
                        </span>

                        <span className="text-xs text-slate-300">
                          ·
                        </span>

                        <span className="text-sm font-medium text-ink truncate">
                          {
                            record.industryLabel
                          }
                        </span>

                        <span className="text-xs text-slate-300">
                          ·
                        </span>

                        <span className="text-xs text-inksoft truncate">
                          {
                            record.docTitle
                          }
                        </span>
                      </div>

                      <div className="text-xs text-inksoft leading-relaxed truncate">
                        {record.validation
                          .map(
                            (field) =>
                              `${field.label}: ${
                                field.value ||
                                "—"
                              }`,
                          )
                          .join(
                            " · ",
                          )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Status */}
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
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

                        {good
                          ? "Valid"
                          : "Review"}
                      </span>

                      {/* Download */}
                      <button
                        type="button"
                        onClick={() =>
                          handleDownloadOne(
                            record,
                          )
                        }
                        disabled={
                          downloading ||
                          sendingEmail ||
                          deleting
                        }
                        title="Download PDF"
                        aria-label={`Download PDF for ${record.docTitle}`}
                        className="group w-9 h-9 rounded-lg border border-line bg-white text-inksoft hover:border-primary hover:bg-primary/5 hover:text-primary flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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

                      {/* Email */}
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenEmail(
                            record,
                          )
                        }
                        disabled={
                          sendingEmail ||
                          downloading ||
                          deleting
                        }
                        title="Email PDF"
                        aria-label={`Email PDF for ${record.docTitle}`}
                        className={`group w-9 h-9 rounded-lg border flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                          emailOpen
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-line bg-white text-inksoft hover:border-primary hover:bg-primary/5 hover:text-primary"
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

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() =>
                          handleDelete(
                            record,
                          )
                        }
                        disabled={
                          deleting ||
                          downloading ||
                          sendingEmail
                        }
                        title="Delete processed document"
                        aria-label={`Delete ${record.docTitle}`}
                        className="group w-9 h-9 rounded-lg border border-red-200 bg-white text-red-500 hover:bg-red-50 hover:border-red-300 hover:text-red-600 flex items-center justify-center transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deleting ? (
                          <div className="w-4 h-4 border-2 border-red-200 border-t-red-500 rounded-full animate-spin" />
                        ) : (
                          <svg
                            className="w-4 h-4 transition-transform duration-150 group-hover:scale-105"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.8}
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6 7h12"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M9 7V5.5A1.5 1.5 0 0110.5 4h3A1.5 1.5 0 0115 5.5V7"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M8 7l.7 12.1a1.5 1.5 0 001.5 1.4h3.6a1.5 1.5 0 001.5-1.4L16 7"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M10 10.5v6"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M14 10.5v6"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Individual email panel */}
                  {emailOpen && (
                    <div className="mt-4 pt-4 border-t border-line/70 animate-fade-in">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="email"
                          value={
                            emailAddress
                          }
                          onChange={(
                            event,
                          ) =>
                            setEmailAddress(
                              event
                                .target
                                .value,
                            )
                          }
                          onKeyDown={(
                            event,
                          ) => {
                            if (
                              event.key ===
                              "Enter"
                            ) {
                              event.preventDefault();
                              handleSendEmail(
                                record,
                              );
                            }
                          }}
                          placeholder="Enter recipient email address"
                          disabled={
                            sendingEmail
                          }
                          autoFocus
                          className="flex-1 min-w-0 border border-line rounded-lg px-3 py-2.5 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:bg-slate-50"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            handleSendEmail(
                              record,
                            )
                          }
                          disabled={
                            sendingEmail ||
                            !emailAddress.trim()
                          }
                          className="bg-primary hover:bg-primary/90 text-white rounded-lg px-5 py-2.5 font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        The generated PDF for this document will be sent as an attachment.
                      </p>
                    </div>
                  )}
                </div>
              );
            },
          )}
        </div>
      )}
    </div>
  );
}