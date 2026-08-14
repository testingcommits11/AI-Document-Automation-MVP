"use client";

import { useState } from "react";
import {
  FieldType,
  IndustryMeta,
  ProcessResult,
} from "@/lib/types";
import {
  exportUpdatedPdf,
  emailUpdatedPdf,
} from "@/lib/api";

type FieldStatus =
  | "valid"
  | "missing"
  | "invalid";

function computeStatus(
  value: string,
  type: FieldType,
): FieldStatus {
  const trimmed = (value || "").trim();

  if (!trimmed) {
    return "missing";
  }

  if (
    type === "number" &&
    !/^[-+]?[\d,]+(?:\.\d+)?$/.test(
      trimmed.replace(/[$\s]/g, ""),
    )
  ) {
    return "invalid";
  }

  if (type === "date") {
    const validDate =
      /^\d{4}-\d{2}-\d{2}$/.test(
        trimmed,
      ) ||
      /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(
        trimmed,
      );

    if (!validDate) {
      return "invalid";
    }
  }

  return "valid";
}

function buildInitial(
  meta: IndustryMeta,
  result: ProcessResult,
): Record<string, string> {
  const initial: Record<
    string,
    string
  > = {};

  for (const field of meta.fields) {
    const match =
      result.validation.find(
        (item) =>
          item.key === field.key,
      );

    initial[field.key] =
      match?.value || "";
  }

  return initial;
}

function getInputType(
  type: FieldType,
): "text" | "date" | "number" {
  if (type === "date") {
    return "date";
  }

  if (type === "number") {
    return "number";
  }

  return "text";
}

function getInputPlaceholder(
  field: {
    label: string;
    type: FieldType;
  },
  mode: "missing" | "invalid",
): string {
  if (field.type === "date") {
    return "Select date";
  }

  if (field.type === "number") {
    return mode === "invalid"
      ? `Correct ${field.label}`
      : `Enter ${field.label}`;
  }

  return mode === "invalid"
    ? `Correct ${field.label}`
    : `Enter ${field.label}`;
}

function getInputClass(
  status: "missing" | "invalid",
): string {
  if (status === "missing") {
    return "w-full text-sm font-mono px-3 py-2.5 rounded-xl border border-amber-300 bg-amber-50/60 outline-none focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-200 text-amber-900 placeholder-amber-400 transition-all";
  }

  return "w-full text-sm font-mono px-3 py-2.5 rounded-xl border border-red-300 bg-red-50/60 outline-none focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-200 text-red-900 placeholder-red-400 transition-all";
}

export default function ExistingDataResults({
  meta,
  result,
  sourceLabel,
  onStartOver,
  onBack,
}: {
  meta: IndustryMeta;
  result: ProcessResult;
  sourceLabel: string;
  onStartOver: () => void;
  onBack: () => void;
}) {
  const [
    fieldsState,
    setFieldsState,
  ] = useState<
    Record<string, string>
  >(() =>
    buildInitial(
      meta,
      result,
    ),
  );

  const [
    validatedState,
    setValidatedState,
  ] = useState<
    Record<string, string>
  >(() =>
    buildInitial(
      meta,
      result,
    ),
  );

  const [
    reviewed,
    setReviewed,
  ] = useState(false);

  const [
    downloading,
    setDownloading,
  ] = useState(false);

  const [
    downloadError,
    setDownloadError,
  ] = useState<string | null>(
    null,
  );

  const [
    showEmail,
    setShowEmail,
  ] = useState(false);

  const [
    recipient,
    setRecipient,
  ] = useState("");

  const [
    emailSending,
    setEmailSending,
  ] = useState(false);

  const [
    emailMessage,
    setEmailMessage,
  ] = useState<string | null>(
    null,
  );

  const live = meta.fields.map(
    (field) => {
      const value =
        validatedState[
          field.key
        ] ?? "";

      return {
        ...field,
        value,
        status: computeStatus(
          value,
          field.type,
        ),
      };
    },
  );

  const complete = live.every(
    (field) =>
      field.status === "valid",
  );

  const missingCount =
    live.filter(
      (field) =>
        field.status ===
        "missing",
    ).length;

  const invalidCount =
    live.filter(
      (field) =>
        field.status ===
        "invalid",
    ).length;

  function handleChange(
    key: string,
    value: string,
  ) {
    setFieldsState(
      (previous) => ({
        ...previous,
        [key]: value,
      }),
    );
  }

  function handleValidateAndUpdate() {
    setValidatedState(
      fieldsState,
    );

    setReviewed(true);
  }

  async function handleEmailPdf() {
    const trimmedRecipient =
      recipient.trim();

    if (!trimmedRecipient) {
      setEmailMessage(
        "Please enter a recipient email address.",
      );
      return;
    }

    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      !emailPattern.test(
        trimmedRecipient,
      )
    ) {
      setEmailMessage(
        "Please enter a valid email address.",
      );
      return;
    }

    setEmailSending(true);
    setEmailMessage(null);

    try {
      await emailUpdatedPdf(
        result.industry,
        fieldsState,
        trimmedRecipient,
      );

      setEmailMessage(
        `PDF sent to ${trimmedRecipient}.`,
      );

      setRecipient("");
      setShowEmail(false);
    } catch (error: any) {
      setEmailMessage(
        error?.message ||
          "Failed to send PDF email.",
      );
    } finally {
      setEmailSending(false);
    }
  }

  async function handleDownloadPdf() {
    setDownloading(true);
    setDownloadError(null);

    try {
      const blob =
        await exportUpdatedPdf(
          result.industry,
          fieldsState,
        );

      const url =
        URL.createObjectURL(blob);

      const anchor =
        document.createElement(
          "a",
        );

      anchor.href = url;
      anchor.download = `${result.industry}_updated_document.pdf`;

      document.body.appendChild(
        anchor,
      );

      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(
        url,
      );
    } catch (error: any) {
      setDownloadError(
        error?.message ||
          "Failed to download PDF.",
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Back */}
      <button
        type="button"
        onClick={onBack}
        className="btn-ghost flex items-center gap-1.5 font-medium text-sm px-4 py-2 rounded-lg"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11 17l-5-5m0 0l5-5m-5 5h12"
          />
        </svg>
        Back
      </button>

      <h2 className="font-display font-semibold text-xl text-ink mb-1">
        Existing Data Validation
      </h2>

      <p className="text-inksoft text-sm mb-1 max-w-md leading-relaxed">
        {meta.label} — {meta.doc_title}
      </p>

      <p className="text-inksoft text-xs font-mono mb-6">
        Source: {sourceLabel}
      </p>

      {/* Overall status */}
      <div
        className={`flex items-center gap-3 px-5 py-4 mb-7 rounded-xl text-sm font-medium transition-all ${
          complete
            ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
            : "bg-amber-50 border border-amber-200 text-amber-700"
        }`}
      >
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            complete
              ? "bg-emerald-100"
              : "bg-amber-100"
          }`}
        >
          {complete ? (
            <svg
              className="w-5 h-5 text-emerald-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5 text-amber-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          )}
        </div>

        <div>
          <p className="font-semibold">
            Overall Status:{" "}
            {complete
              ? "✓ Complete"
              : "⚠ Incomplete"}
          </p>

          {!complete && (
            <p className="text-xs font-normal text-amber-600/90 mt-0.5">
              {missingCount > 0 &&
                `${missingCount} field${
                  missingCount > 1
                    ? "s"
                    : ""
                } missing`}

              {missingCount >
                0 &&
                invalidCount >
                  0 &&
                " · "}

              {invalidCount > 0 &&
                `${invalidCount} field${
                  invalidCount > 1
                    ? "s"
                    : ""
                } look incorrect or inconsistent`}{" "}
              — fill or correct them below.
            </p>
          )}
        </div>
      </div>

      {/* Field list */}
      <div className="border border-line rounded-2xl p-5 bg-white space-y-5">
        {live.map(
          (field, index) => (
            <div
              key={field.key}
              className={`pb-5 ${
                index <
                live.length - 1
                  ? "border-b border-line/70"
                  : "pb-0"
              }`}
            >
              <div className="flex items-center gap-2 text-inksoft text-xs font-medium mb-1.5">
                <span>
                  {field.label}
                </span>

                {field.type ===
                  "date" && (
                  <span className="text-[10px] font-mono uppercase tracking-wide bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                    Date
                  </span>
                )}

                {field.type ===
                  "number" && (
                  <span className="text-[10px] font-mono uppercase tracking-wide bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                    Number
                  </span>
                )}
              </div>

              {/* Valid */}
              {field.status ===
                "valid" && (
                <div className="flex items-center justify-between gap-4">
                  <span className="font-mono text-sm font-medium text-ink break-words">
                    {field.value}
                  </span>

                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1 whitespace-nowrap">
                    <svg
                      className="w-3 h-3"
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
                    Available
                  </span>
                </div>
              )}

              {/* Missing */}
              {field.status ===
                "missing" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm text-slate-400 italic">
                      [ Missing ]
                    </span>

                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                      ⚠ Required
                    </span>
                  </div>

                  <input
                    type={getInputType(
                      field.type,
                    )}
                    inputMode={
                      field.type ===
                      "number"
                        ? "decimal"
                        : undefined
                    }
                    value={
                      fieldsState[
                        field.key
                      ] ?? ""
                    }
                    onChange={(event) =>
                      handleChange(
                        field.key,
                        event.target
                          .value,
                      )
                    }
                    placeholder={getInputPlaceholder(
                      field,
                      "missing",
                    )}
                    className={getInputClass(
                      "missing",
                    )}
                  />
                </div>
              )}

              {/* Invalid */}
              {field.status ===
                "invalid" && (
                <div>
                  <div className="flex items-center justify-between mb-2 gap-3">
                    <span className="font-mono text-sm text-red-500 line-through decoration-red-300 break-words">
                      {field.value}
                    </span>

                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2.5 py-1 whitespace-nowrap">
                      ⚠ Incorrect / Inconsistent
                    </span>
                  </div>

                  <input
                    type={getInputType(
                      field.type,
                    )}
                    inputMode={
                      field.type ===
                      "number"
                        ? "decimal"
                        : undefined
                    }
                    value={
                      fieldsState[
                        field.key
                      ] ?? ""
                    }
                    onChange={(event) =>
                      handleChange(
                        field.key,
                        event.target
                          .value,
                      )
                    }
                    placeholder={getInputPlaceholder(
                      field,
                      "invalid",
                    )}
                    className={getInputClass(
                      "invalid",
                    )}
                  />
                </div>
              )}
            </div>
          ),
        )}
      </div>

      {/* Validation helper */}
      {reviewed ? (
        <p className="text-xs font-mono text-inksoft mt-3">
          {complete
            ? "✓ Validated — all fields check out."
            : "Checked current values — some fields still need attention."}
        </p>
      ) : (
        <p className="text-xs font-mono text-slate-400 mt-3">
          Edits above won't be checked until you click
          "Validate & Update".
        </p>
      )}

      {/* Errors / messages */}
      {downloadError && (
        <p className="text-xs text-red-500 font-mono mt-2">
          {downloadError}
        </p>
      )}

      {emailMessage && (
        <p className="text-xs text-inksoft font-mono mt-2">
          {emailMessage}
        </p>
      )}

      {/* Email panel */}
      {showEmail && (
        <div className="mt-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center border border-line rounded-xl p-3 bg-slate-50/70">
          <input
            type="email"
            value={recipient}
            onChange={(event) =>
              setRecipient(
                event.target.value,
              )
            }
            onKeyDown={(event) => {
              if (
                event.key ===
                "Enter"
              ) {
                event.preventDefault();
                handleEmailPdf();
              }
            }}
            placeholder="recipient@example.com"
            disabled={emailSending}
            className="flex-1 border border-line rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:bg-slate-50"
          />

          <button
            type="button"
            disabled={
              emailSending ||
              !recipient.trim()
            }
            onClick={
              handleEmailPdf
            }
            className="btn-gradient rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {emailSending
              ? "Sending…"
              : "Send"}
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 mt-7 flex-wrap items-center">
        <button
          type="button"
          onClick={
            handleValidateAndUpdate
          }
          className="btn-gradient font-semibold text-sm px-6 py-3 rounded-xl flex items-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>

          Validate & Update
        </button>

        <button
          type="button"
          onClick={
            handleDownloadPdf
          }
          disabled={downloading}
          className="bg-slate-900 hover:bg-slate-800 active:bg-black text-white font-medium text-sm px-5 py-3 rounded-xl flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
        >
          {downloading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg
              className="w-4 h-4 text-emerald-400"
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

          {downloading
            ? "Generating PDF…"
            : "Download PDF"}
        </button>

        <button
          type="button"
          onClick={() => {
            setEmailMessage(null);
            setShowEmail(
              (previous) =>
                !previous,
            );
          }}
          className={`${
            showEmail
              ? "border-primary bg-primary/5 text-primary"
              : "border-line bg-white text-inksoft hover:border-primary hover:text-primary"
          } border font-medium text-sm px-5 py-3 rounded-xl flex items-center gap-2 transition-all`}
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

          {showEmail
            ? "Close Email"
            : "Email PDF"}
        </button>

        <button
          type="button"
          onClick={
            onStartOver
          }
          className="btn-ghost flex items-center gap-1.5 font-medium text-sm px-4 py-2 rounded-lg"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>

          Validate Another Document
        </button>

        <button
          type="button"
          onClick={onBack}
          className="btn-ghost flex items-center gap-1.5 font-medium text-sm px-4 py-2 rounded-lg"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11 17l-5-5m0 0l5-5m-5 5h12"
            />
          </svg>

          Back
        </button>
      </div>
    </div>
  );
}