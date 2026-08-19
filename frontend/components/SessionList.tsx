"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { SessionRecord } from "@/lib/types";

import {
  deleteProcessedDocument,
  deleteProcessedDocuments,
  emailCombinedPdf,
  emailPdf,
  exportCombinedPdf,
  exportUpdatedPdf,
} from "@/lib/api";


// ============================================================================
// HELPERS
// ============================================================================

function downloadBlob(
  blob: Blob,
  filename: string,
) {
  const url =
    URL.createObjectURL(blob);

  const anchor =
    document.createElement("a");

  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(
    anchor,
  );

  anchor.click();

  anchor.remove();

  URL.revokeObjectURL(
    url,
  );
}


// ============================================================================
// COMPONENT
// ============================================================================

export default function SessionList({
  records,
  onDelete,
}: {
  records: SessionRecord[];

  onDelete: (
    documentId: number,
  ) => Promise<void> | void;
}) {
  // ==========================================================================
  // DOWNLOAD STATE
  // ==========================================================================

  const [
    downloadingAll,
    setDownloadingAll,
  ] = useState(false);

  const [
    downloadingId,
    setDownloadingId,
  ] = useState<string | null>(
    null,
  );


  // ==========================================================================
  // EMAIL STATE
  // ==========================================================================

  const [
    emailOpenId,
    setEmailOpenId,
  ] = useState<string | null>(
    null,
  );

  const [
    emailAddress,
    setEmailAddress,
  ] = useState("");

  const [
    sendingEmailId,
    setSendingEmailId,
  ] = useState<string | null>(
    null,
  );

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


  // ==========================================================================
  // DELETE STATE
  // ==========================================================================

  const [
    deletingId,
    setDeletingId,
  ] = useState<string | null>(
    null,
  );

  const [
    deletingSelected,
    setDeletingSelected,
  ] = useState(false);


  // ==========================================================================
  // SELECTION STATE
  // ==========================================================================

  const [
    selectedIds,
    setSelectedIds,
  ] = useState<Set<number>>(
    new Set(),
  );


  // ==========================================================================
  // MESSAGE STATE
  // ==========================================================================

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  const [
    emailSuccess,
    setEmailSuccess,
  ] = useState<string | null>(
    null,
  );


  // ==========================================================================
  // MESSAGE TIMERS
  // ==========================================================================

  const errorTimerRef =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(null);

  const successTimerRef =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(null);


  useEffect(() => {
    return () => {
      if (
        errorTimerRef.current
      ) {
        clearTimeout(
          errorTimerRef.current,
        );
      }

      if (
        successTimerRef.current
      ) {
        clearTimeout(
          successTimerRef.current,
        );
      }
    };
  }, []);


  // ==========================================================================
  // TEMPORARY MESSAGE HELPERS
  // ==========================================================================

  function showError(
    message: string,
  ) {
    if (
      errorTimerRef.current
    ) {
      clearTimeout(
        errorTimerRef.current,
      );
    }

    setError(
      message,
    );

    errorTimerRef.current =
      setTimeout(() => {
        setError(
          null,
        );

        errorTimerRef.current =
          null;
      }, 4000);
  }


  function showSuccess(
    message: string,
  ) {
    if (
      successTimerRef.current
    ) {
      clearTimeout(
        successTimerRef.current,
      );
    }

    setEmailSuccess(
      message,
    );

    successTimerRef.current =
      setTimeout(() => {
        setEmailSuccess(
          null,
        );

        successTimerRef.current =
          null;
      }, 4000);
  }


  function clearMessages() {
    if (
      errorTimerRef.current
    ) {
      clearTimeout(
        errorTimerRef.current,
      );

      errorTimerRef.current =
        null;
    }

    if (
      successTimerRef.current
    ) {
      clearTimeout(
        successTimerRef.current,
      );

      successTimerRef.current =
        null;
    }

    setError(null);
    setEmailSuccess(null);
  }


  // ==========================================================================
  // DOCUMENT IDS
  // ==========================================================================

  const documentIds =
    useMemo(() => {
      return records
        .map(
          (record) =>
            Number(
              record.document_id ??
                record.id,
            ),
        )
        .filter(
          (id) =>
            Number.isFinite(id),
        );
    }, [records]);


  // ==========================================================================
  // KEEP SELECTION IN SYNC
  // ==========================================================================

  useEffect(() => {
    setSelectedIds(
      (previous) => {
        const validIds =
          new Set(
            documentIds,
          );

        const next =
          new Set(
            Array.from(
              previous,
            ).filter(
              (id) =>
                validIds.has(
                  id,
                ),
            ),
          );

        if (
          next.size ===
          previous.size
        ) {
          return previous;
        }

        return next;
      },
    );
  }, [
    documentIds,
  ]);


  const selectedCount =
    selectedIds.size;


  const allSelected =
    documentIds.length > 0 &&
    documentIds.every(
      (id) =>
        selectedIds.has(
          id,
        ),
    );


  // ==========================================================================
  // SELECT ONE
  // ==========================================================================

  function handleSelectOne(
    documentId: number,
  ) {
    setSelectedIds(
      (previous) => {
        const next =
          new Set(
            previous,
          );

        if (
          next.has(
            documentId,
          )
        ) {
          next.delete(
            documentId,
          );
        } else {
          next.add(
            documentId,
          );
        }

        return next;
      },
    );
  }


  // ==========================================================================
  // SELECT ALL
  // ==========================================================================

  function handleSelectAll() {
    if (allSelected) {
      setSelectedIds(
        new Set(),
      );

      return;
    }

    setSelectedIds(
      new Set(
        documentIds,
      ),
    );
  }


  // ==========================================================================
  // DOWNLOAD ALL
  // ==========================================================================

  async function handleDownloadAll() {
    clearMessages();

    setDownloadingAll(
      true,
    );

    try {
      const blob =
        await exportCombinedPdf(
          records,
        );

      downloadBlob(
        blob,
        "processed_documents_combined.pdf",
      );

      showSuccess(
        "Combined PDF downloaded successfully.",
      );
    } catch (e: any) {
      showError(
        e?.message ||
          "Failed to download combined PDF.",
      );
    } finally {
      setDownloadingAll(
        false,
      );
    }
  }


  // ==========================================================================
  // DOWNLOAD ONE
  // ==========================================================================

  async function handleDownloadOne(
    record: SessionRecord,
  ) {
    clearMessages();

    setDownloadingId(
      record.id,
    );

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

      showSuccess(
        "PDF downloaded successfully.",
      );
    } catch (e: any) {
      showError(
        e?.message ||
          "Failed to download PDF.",
      );
    } finally {
      setDownloadingId(
        null,
      );
    }
  }


  // ==========================================================================
  // OPEN INDIVIDUAL EMAIL
  // ==========================================================================

  function handleOpenEmail(
    record: SessionRecord,
  ) {
    clearMessages();

    setEmailOpenId(
      emailOpenId ===
        record.id
        ? null
        : record.id,
    );

    setEmailAddress("");

    setEmailAllOpen(
      false,
    );

    setEmailAllAddress("");
  }


  // ==========================================================================
  // SEND INDIVIDUAL EMAIL
  // ==========================================================================

  async function handleSendEmail(
    record: SessionRecord,
  ) {
    const recipient =
      emailAddress.trim();

    if (!recipient) {
      showError(
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
      showError(
        "Please enter a valid email address.",
      );

      return;
    }

    clearMessages();

    setSendingEmailId(
      record.id,
    );

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

      setEmailAddress(
        "",
      );

      setEmailOpenId(
        null,
      );

      showSuccess(
        `PDF sent successfully to ${recipient}.`,
      );
    } catch (e: any) {
      showError(
        e?.message ||
          "Failed to send PDF by email.",
      );
    } finally {
      setSendingEmailId(
        null,
      );
    }
  }


  // ==========================================================================
  // DELETE ONE
  // ==========================================================================

  async function handleDelete(
    record: SessionRecord,
  ) {
    const documentId =
      Number(
        record.document_id ??
          record.id,
      );

    if (
      !Number.isFinite(
        documentId,
      )
    ) {
      showError(
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

    clearMessages();

    setDeletingId(
      record.id,
    );

    try {
      await deleteProcessedDocument(
        documentId,
      );

      await onDelete(
        documentId,
      );

      setSelectedIds(
        (previous) => {
          const next =
            new Set(
              previous,
            );

          next.delete(
            documentId,
          );

          return next;
        },
      );

      setEmailOpenId(
        null,
      );

      setEmailAddress(
        "",
      );

      showSuccess(
        `"${record.docTitle}" deleted successfully.`,
      );
    } catch (e: any) {
      showError(
        e?.message ||
          "Failed to delete processed document.",
      );
    } finally {
      setDeletingId(
        null,
      );
    }
  }


  // ==========================================================================
  // DELETE SELECTED
  // ==========================================================================

  async function handleDeleteSelected() {
    const ids =
      Array.from(
        selectedIds,
      );

    if (!ids.length) {
      showError(
        "Please select at least one document.",
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Delete ${ids.length} selected document${
          ids.length > 1
            ? "s"
            : ""
        }? This cannot be undone.`,
      );

    if (!confirmed) {
      return;
    }

    clearMessages();

    setDeletingSelected(
      true,
    );

    try {
      const response =
        await deleteProcessedDocuments(
          ids,
        );

      const deletedIds =
        response.deleted_ids ||
        [];

      if (
        !deletedIds.length
      ) {
        throw new Error(
          "No selected documents were deleted.",
        );
      }

      for (
        const documentId of deletedIds
      ) {
        await onDelete(
          documentId,
        );
      }

      setSelectedIds(
        new Set(),
      );

      setEmailOpenId(
        null,
      );

      setEmailAddress(
        "",
      );

      showSuccess(
        `${deletedIds.length} document${
          deletedIds.length > 1
            ? "s"
            : ""
        } deleted successfully.`,
      );
    } catch (e: any) {
      showError(
        e?.message ||
          "Failed to delete selected documents.",
      );
    } finally {
      setDeletingSelected(
        false,
      );
    }
  }


  // ==========================================================================
  // EMAIL ALL
  // ==========================================================================

  async function handleEmailAll() {
    const recipient =
      emailAllAddress.trim();

    if (!recipient) {
      showError(
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
      showError(
        "Please enter a valid email address.",
      );

      return;
    }

    if (!records.length) {
      showError(
        "There are no processed documents to email.",
      );

      return;
    }

    clearMessages();

    setSendingEmailAll(
      true,
    );

    try {
      await emailCombinedPdf(
        records,
        recipient,
      );

      setEmailAllAddress(
        "",
      );

      setEmailAllOpen(
        false,
      );

      showSuccess(
        `Combined PDF sent successfully to ${recipient}.`,
      );
    } catch (e: any) {
      showError(
        e?.message ||
          "Failed to send combined PDF by email.",
      );
    } finally {
      setSendingEmailAll(
        false,
      );
    }
  }


  // ==========================================================================
  // EMPTY STATE
  // ==========================================================================

  if (
    records.length === 0
  ) {
    return (
      <div className="mt-14">

        <div className="flex items-center gap-3 mb-5">
          <h3 className="font-display font-semibold text-lg text-ink">
            Processed Documents
          </h3>

          <span className="bg-primarysoft text-primary text-xs font-semibold px-2.5 py-0.5 rounded-full">
            0
          </span>
        </div>

        <p className="font-mono text-[11px] text-inksoft mb-5">
          Your processed documents
          are saved to your account
          and remain available after
          refresh.
        </p>

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
            Processed documents will
            remain available after
            page refresh.
          </p>
        </div>
      </div>
    );
  }


  // ==========================================================================
  // MAIN
  // ==========================================================================

  return (
    <div className="mt-14">

      {/* ======================================================================
          HEADER
      ======================================================================= */}

      <div className="flex items-center gap-3 mb-5 flex-wrap">

        <h3 className="font-display font-semibold text-lg text-ink">
          Processed Documents
        </h3>

        <span className="bg-primarysoft text-primary text-xs font-semibold px-2.5 py-0.5 rounded-full">
          {records.length}
        </span>

        {selectedCount >
          0 && (
          <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
            {selectedCount} selected
          </span>
        )}

        <div className="ml-auto flex items-center gap-2 flex-wrap">

          {/* Select All */}

          <button
            type="button"
            onClick={
              handleSelectAll
            }
            disabled={
              deletingSelected
            }
            className={`font-medium text-xs px-4 py-2.5 rounded-lg border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              allSelected
                ? "border-primary bg-primary/5 text-primary"
                : "border-line bg-white text-ink hover:border-primary hover:text-primary"
            }`}
            title={
              allSelected
                ? "Clear selection"
                : "Select all documents"
            }
          >
            {allSelected
              ? "Clear Selection"
              : "Select All"}
          </button>


          {/* Delete Selected */}

          {selectedCount >
            0 && (
            <button
              type="button"
              onClick={
                handleDeleteSelected
              }
              disabled={
                deletingSelected ||
                downloadingAll ||
                sendingEmailAll
              }
              className="bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-medium text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deletingSelected ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M9 3.75h6"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />

                  <path
                    d="M4.75 6.5h14.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />

                  <path
                    d="M8 6.5l.7 12.1a1.75 1.75 0 001.75 1.65h3.1a1.75 1.75 0 001.75-1.65L16 6.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  <path
                    d="M10 10v6"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />

                  <path
                    d="M14 10v6"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              )}

              {deletingSelected
                ? "Deleting…"
                : `Delete Selected (${selectedCount})`}
            </button>
          )}


          {/* Download All */}

          <button
            type="button"
            onClick={
              handleDownloadAll
            }
            disabled={
              downloadingAll ||
              sendingEmailAll ||
              deletingSelected
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


          {/* Email All */}

          <button
            type="button"
            onClick={() => {
              setEmailAllOpen(
                (value) =>
                  !value,
              );

              setEmailOpenId(
                null,
              );

              setEmailAddress("");
            }}
            disabled={
              sendingEmailAll ||
              downloadingAll ||
              deletingSelected
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
      </div>


      <p className="font-mono text-[11px] text-inksoft mb-5">
        Select one or more documents
        to delete them together.
        Your processed documents
        remain saved after refresh.
      </p>


      {/* ======================================================================
          EMAIL ALL PANEL
      ======================================================================= */}

      {emailAllOpen && (
        <div className="mb-5 rounded-xl border border-line bg-white p-4 shadow-card animate-fade-in">

          <div className="flex flex-col sm:flex-row gap-2">

            <input
              type="email"
              value={
                emailAllAddress
              }
              onChange={(
                event,
              ) =>
                setEmailAllAddress(
                  event.target.value,
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

                  handleEmailAll();
                }
              }}
              placeholder="Enter recipient email address"
              disabled={
                sendingEmailAll
              }
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
              className="bg-primary hover:bg-primary/90 active:bg-primary/80 text-white rounded-lg px-5 py-2.5 font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sendingEmailAll ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : null}

              {sendingEmailAll
                ? "Sending…"
                : "Send All"}
            </button>
          </div>

          <p className="text-[10px] text-inksoft font-mono mt-2">
            All {records.length} processed
            documents will be included
            in one combined PDF attachment.
          </p>
        </div>
      )}


      {/* ======================================================================
          ERROR
      ======================================================================= */}

      {error && (
        <div className="text-xs text-red-500 font-mono mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 animate-fade-in">
          {error}
        </div>
      )}


      {/* ======================================================================
          SUCCESS
      ======================================================================= */}

      {emailSuccess && (
        <div className="text-xs text-emerald-600 font-mono mb-4 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2.5 animate-fade-in">
          {emailSuccess}
        </div>
      )}


      {/* ======================================================================
          DOCUMENT LIST
      ======================================================================= */}

      <div className="space-y-3">

        {records.map(
          (
            record,
            index,
          ) => {
            const documentId =
              Number(
                record.document_id ??
                  record.id,
              );

            const selected =
              selectedIds.has(
                documentId,
              );

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
                key={
                  record.id
                }
                className={`card-lift bg-white border rounded-xl px-5 py-4 shadow-card animate-fade-in transition-all ${
                  selected
                    ? "border-primary/50 bg-primary/[0.02]"
                    : "border-line/70"
                }`}
              >

                {/* ==========================================================
                    MAIN ROW
                =========================================================== */}

                <div className="flex justify-between items-start gap-4">

                  <div className="flex items-start gap-3 min-w-0 flex-1">

                    {/* CHECKBOX */}

                    <label
                      className="pt-1 flex-shrink-0 cursor-pointer"
                      title="Select document"
                    >
                      <input
                        type="checkbox"
                        checked={
                          selected
                        }
                        onChange={() =>
                          handleSelectOne(
                            documentId,
                          )
                        }
                        disabled={
                          deletingSelected ||
                          deleting
                        }
                        className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/30 cursor-pointer disabled:opacity-50"
                      />
                    </label>


                    {/* DOCUMENT INFORMATION */}

                    <div className="min-w-0 flex-1">

                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">

                        <span className="text-xs font-mono text-slate-400">
                          #
                          {records.length -
                            index}
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
                            (
                              field,
                            ) =>
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
                  </div>


                  {/* ========================================================
                      ACTIONS
                  ========================================================= */}

                  <div className="flex items-center gap-2 flex-shrink-0">

                    {/* STATUS */}

                    <span
                      className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
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


                    {/* DOWNLOAD */}

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
                        deleting ||
                        deletingSelected
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


                    {/* EMAIL */}

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
                        deleting ||
                        deletingSelected
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


                    {/* DELETE */}

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
                        sendingEmail ||
                        deletingSelected
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
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          aria-hidden="true"
                        >
                          <path
                            d="M9 3.75h6"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />

                          <path
                            d="M4.75 6.5h14.5"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />

                          <path
                            d="M8 6.5l.7 12.1a1.75 1.75 0 001.75 1.65h3.1a1.75 1.75 0 001.75-1.65L16 6.5"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />

                          <path
                            d="M10 10v6"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />

                          <path
                            d="M14 10v6"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>


                {/* ==========================================================
                    INDIVIDUAL EMAIL PANEL
                =========================================================== */}

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
                      The generated PDF for
                      this document will be
                      sent as an attachment.
                    </p>
                  </div>
                )}
              </div>
            );
          },
        )}
      </div>


      {/* ======================================================================
          SELECTION FOOTER
      ======================================================================= */}

      <div className="mt-4 flex items-center justify-between gap-3">

        <button
          type="button"
          onClick={
            handleSelectAll
          }
          disabled={
            deletingSelected
          }
          className="flex items-center gap-2 text-xs font-medium text-inksoft hover:text-primary transition-colors disabled:opacity-50"
        >
          <span
            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
              allSelected
                ? "bg-primary border-primary"
                : "border-slate-300 bg-white"
            }`}
          >
            {allSelected && (
              <svg
                className="w-3 h-3 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </span>

          {allSelected
            ? "Clear selection"
            : "Select all documents"}
        </button>


        {selectedCount >
          0 && (
          <span className="text-xs font-mono text-inksoft">
            {selectedCount} of{" "}
            {records.length}{" "}
            selected
          </span>
        )}
      </div>
    </div>
  );
}