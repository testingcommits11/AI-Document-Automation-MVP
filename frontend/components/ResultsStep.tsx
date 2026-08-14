"use client";

import { useEffect, useState } from "react";
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

/**
 * Returns today's date in the format required by
 * <input type="date">.
 */
function getTodayInputValue(): string {
  const today = new Date();

  const year = today.getFullYear();

  const month = String(
    today.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    today.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Checks whether a field value is valid.
 *
 * Rules:
 * - Empty values are invalid/missing.
 * - Number fields must contain a valid numeric value.
 * - Date fields must be YYYY-MM-DD and cannot be in the future.
 * - Text fields are considered valid when non-empty.
 */
function checkFieldOk(
  val: string,
  type: FieldType = "text",
): boolean {
  const trimmed = (val || "").trim();

  if (!trimmed) {
    return false;
  }

  // Number validation
  if (type === "number") {
    const normalized = trimmed
      .replace(/[$,\s]/g, "");

    return /^[-+]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(
      normalized,
    );
  }

  // Date validation
  if (type === "date") {
    // Date input always returns YYYY-MM-DD.
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        trimmed,
      )
    ) {
      return false;
    }

    const selectedDate = new Date(
      `${trimmed}T00:00:00`,
    );

    if (
      Number.isNaN(
        selectedDate.getTime(),
      )
    ) {
      return false;
    }

    const today = new Date();

    today.setHours(
      0,
      0,
      0,
      0,
    );

    // Future dates are not allowed.
    return selectedDate <= today;
  }

  // Text fields
  return true;
}

/**
 * Converts an existing date value to YYYY-MM-DD
 * so it can be displayed in a native date input.
 */
function formatToIsoDate(
  val: string,
): string {
  if (!val) {
    return "";
  }

  // Already normalized.
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      val,
    )
  ) {
    return val;
  }

  const parsed = Date.parse(val);

  if (!Number.isNaN(parsed)) {
    const date = new Date(parsed);

    const yyyy =
      date.getFullYear();

    const mm = String(
      date.getMonth() + 1,
    ).padStart(2, "0");

    const dd = String(
      date.getDate(),
    ).padStart(2, "0");

    return `${yyyy}-${mm}-${dd}`;
  }

  return "";
}

function getInputClass(
  valid: boolean,
): string {
  if (!valid) {
    return "w-full text-sm font-mono px-3 py-2 rounded-xl border border-amber-300 bg-amber-50/60 outline-none focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-200 text-amber-900 placeholder-amber-400 transition-all";
  }

  return "w-full text-sm font-mono px-3 py-2 rounded-xl border border-line bg-slate-50/50 outline-none focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 text-ink transition-all";
}

export default function ResultsStep({
  meta,
  result,
  onAnother,
  onBackToPreview,
  onResultUpdate,
}: {
  meta: IndustryMeta;
  result: ProcessResult;
  onAnother: () => void;
  onBackToPreview: () => void;
  onResultUpdate?: (
    updated: ProcessResult,
  ) => void;
}) {
  // --------------------------------------------------------------------------
  // Field values
  // --------------------------------------------------------------------------

  const [
    fieldsState,
    setFieldsState,
  ] = useState<
    Record<string, string>
  >(() => {
    const initial: Record<
      string,
      string
    > = {};

    for (const item of result.validation) {
      initial[item.key] =
        item.value || "";
    }

    return initial;
  });

  // --------------------------------------------------------------------------
  // Edited state
  // --------------------------------------------------------------------------

  const [
    editedKeys,
    setEditedKeys,
  ] = useState<
    Record<string, boolean>
  >({});

  const [
    editAll,
    setEditAll,
  ] = useState(false);

  // --------------------------------------------------------------------------
  // Download
  // --------------------------------------------------------------------------

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

  // --------------------------------------------------------------------------
  // Email
  // --------------------------------------------------------------------------

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

  // --------------------------------------------------------------------------
  // Keep locally edited values aligned with live schema changes.
  // --------------------------------------------------------------------------

  useEffect(() => {
    setFieldsState(
      (previous) => {
        const next = {
          ...previous,
        };

        for (const field of meta.fields) {
          if (!(field.key in next)) {
            next[field.key] =
              result.extracted?.[
                field.key
              ] || "";
          }
        }

        return next;
      },
    );
  }, [
    meta.fields,
    result.extracted,
  ]);

  // --------------------------------------------------------------------------
  // Get field type
  // --------------------------------------------------------------------------

  const getFieldType = (
    key: string,
  ): FieldType => {
    const field =
      meta.fields.find(
        (item) =>
          item.key === key,
      );

    return field
      ? field.type
      : "text";
  };

  // --------------------------------------------------------------------------
  // Build current validation from LIVE schema
  // --------------------------------------------------------------------------

  const liveValidation =
    meta.fields.map(
      (field) => {
        const existing =
          result.validation.find(
            (item) =>
              item.key ===
              field.key,
          );

        const currentValue =
          fieldsState[field.key] ??
          existing?.value ??
          "";

        const ok =
          checkFieldOk(
            currentValue,
            field.type,
          );

        const isEdited =
          Boolean(
            editedKeys[
              field.key
            ],
          );

        return {
          key: field.key,
          label: field.label,
          type: field.type,
          value: currentValue,
          ok,
          status: ok
            ? ("valid" as const)
            : ("invalid" as const),
          isEdited,
        };
      },
    );

  const allValid =
    liveValidation.every(
      (field) => field.ok,
    );

  // --------------------------------------------------------------------------
  // Handle field changes
  // --------------------------------------------------------------------------

  const handleFieldChange = (
    key: string,
    newValue: string,
  ) => {
    const nextState = {
      ...fieldsState,
      [key]: newValue,
    };

    setFieldsState(
      nextState,
    );

    setEditedKeys(
      (previous) => ({
        ...previous,
        [key]: true,
      }),
    );

    if (onResultUpdate) {
      const updatedValidation =
        result.validation.map(
          (field) => {
            const value =
              field.key === key
                ? newValue
                : fieldsState[
                    field.key
                  ] ??
                  field.value;

            const fieldType =
              getFieldType(
                field.key,
              );

            return {
              ...field,
              value,
              ok: checkFieldOk(
                value,
                fieldType,
              ),
            };
          },
        );

      onResultUpdate({
        ...result,
        extracted: nextState,
        validation:
          updatedValidation,
        overall:
          updatedValidation.every(
            (field) =>
              field.ok,
          )
            ? "ready"
            : "review",
      });
    }
  };

  // --------------------------------------------------------------------------
  // Email PDF
  // --------------------------------------------------------------------------

  const handleEmailPdf =
    async () => {
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
    };

  // --------------------------------------------------------------------------
  // Download PDF
  // --------------------------------------------------------------------------

  const handleDownloadPdf =
    async () => {
      setDownloading(true);
      setDownloadError(null);

      try {
        const blob =
          await exportUpdatedPdf(
            result.industry,
            fieldsState,
          );

        const url =
          URL.createObjectURL(
            blob,
          );

        const anchor =
          document.createElement(
            "a",
          );

        anchor.href = url;

        anchor.download = `${result.industry}_filled_document.pdf`;

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
            "Failed to download PDF",
        );
      } finally {
        setDownloading(false);
      }
    };

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="animate-fade-in">
      {/* Back */}
      <button
        type="button"
        onClick={
          onBackToPreview
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
            d="M11 17l-5-5m0 0l5-5m-5 5h12"
          />
        </svg>

        Back to preview
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h2 className="font-display font-semibold text-xl text-ink">
          Results — {meta.label}
        </h2>

        <button
          type="button"
          onClick={() =>
            setEditAll(
              (previous) =>
                !previous,
            )
          }
          className="text-xs font-mono px-3 py-1.5 rounded-lg border border-line hover:border-primary/40 bg-white text-inksoft hover:text-ink transition-colors flex items-center gap-1.5 self-start sm:self-auto"
        >
          <svg
            className="w-3.5 h-3.5 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>

          {editAll
            ? "Done Editing All"
            : "Edit All Fields"}
        </button>
      </div>

      {/* Status banner */}
      <div
        className={`flex items-center gap-3 px-5 py-4 mb-7 rounded-xl text-sm font-medium transition-all ${
          allValid
            ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
            : "bg-amber-50 border border-amber-200 text-amber-700"
        }`}
      >
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            allValid
              ? "bg-emerald-100"
              : "bg-amber-100"
          }`}
        >
          {allValid ? (
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
            {allValid
              ? "Document processed successfully — all fields validated"
              : "Document processed — some fields need review"}
          </p>

          {!allValid && (
            <p className="text-xs font-normal text-amber-600/90 mt-0.5">
              Please complete or correct the highlighted input fields below.
            </p>
          )}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Extracted information */}
        <div>
          <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-inksoft mb-3">
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
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>

            Extracted Information & Edit Inputs
          </span>

          <div className="border border-line rounded-2xl p-5 bg-white space-y-4">
            {liveValidation.map(
              (field, index) => {
                const showInput =
                  editAll ||
                  !field.ok ||
                  field.isEdited;

                const fieldType =
                  getFieldType(
                    field.key,
                  );

                const normalizedDate =
                  fieldType ===
                  "date"
                    ? formatToIsoDate(
                        field.value,
                      )
                    : "";

                return (
                  <div
                    key={field.key}
                    className={`py-2.5 ${
                      index <
                      liveValidation.length -
                        1
                        ? "border-b border-line/70"
                        : ""
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <label
                        htmlFor={`input-${field.key}`}
                        className="text-inksoft text-xs font-medium flex items-center gap-1.5"
                      >
                        {field.label}

                        {fieldType ===
                          "date" && (
                          <span className="text-[10px] text-inksoft/60 font-mono">
                            (date)
                          </span>
                        )}

                        {fieldType ===
                          "number" && (
                          <span className="text-[10px] text-inksoft/60 font-mono">
                            (number)
                          </span>
                        )}
                      </label>

                      {field.isEdited && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                          user filled
                        </span>
                      )}
                    </div>

                    {showInput ? (
                      <div className="mt-1">
                        {/* DATE */}
                        {fieldType ===
                        "date" ? (
                          <div className="flex flex-col gap-1.5">
                            <input
                              id={`input-${field.key}`}
                              type="date"
                              value={
                                normalizedDate
                              }
                              max={getTodayInputValue()}
                              onChange={(
                                event,
                              ) =>
                                handleFieldChange(
                                  field.key,
                                  event.target
                                    .value,
                                )
                              }
                              className={`${getInputClass(
                                field.ok,
                              )} cursor-pointer`}
                            />

                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-slate-400 font-mono">
                                Maximum allowed date:{" "}
                                {getTodayInputValue()}
                              </span>

                              {field.value &&
                                !/^\d{4}-\d{2}-\d{2}$/.test(
                                  field.value,
                                ) && (
                                  <span className="text-[11px] text-inksoft font-mono">
                                    Current value:{" "}
                                    <span className="font-semibold text-ink">
                                      {
                                        field.value
                                      }
                                    </span>
                                  </span>
                                )}

                              {field.value &&
                                /^\d{4}-\d{2}-\d{2}$/.test(
                                  field.value,
                                ) &&
                                !field.ok && (
                                  <span className="text-[11px] text-red-600 font-mono">
                                    ⚠ Future dates are not allowed.
                                  </span>
                                )}
                            </div>
                          </div>
                        ) : fieldType ===
                          "number" ? (
                          /* NUMBER */
                          <input
                            id={`input-${field.key}`}
                            type="text"
                            inputMode="decimal"
                            value={
                              field.value
                            }
                            onChange={(
                              event,
                            ) =>
                              handleFieldChange(
                                field.key,
                                event.target
                                  .value,
                              )
                            }
                            placeholder={`Enter ${field.label.toLowerCase()} (e.g. 250 or $250)…`}
                            className={getInputClass(
                              field.ok,
                            )}
                          />
                        ) : (
                          /* TEXT */
                          <input
                            id={`input-${field.key}`}
                            type="text"
                            value={
                              field.value
                            }
                            onChange={(
                              event,
                            ) =>
                              handleFieldChange(
                                field.key,
                                event.target
                                  .value,
                              )
                            }
                            placeholder={`Fill missing ${field.label.toLowerCase()}…`}
                            className={getInputClass(
                              field.ok,
                            )}
                          />
                        )}

                        {!field.ok &&
                          fieldType !==
                            "date" && (
                            <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1 font-sans">
                              ⚠️ Missing or invalid data — enter a value to complete validation
                            </p>
                          )}

                        {!field.ok &&
                          fieldType ===
                            "date" &&
                          field.value && (
                            <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1 font-sans">
                              ⚠️ Invalid date — future dates are not allowed
                            </p>
                          )}
                      </div>
                    ) : (
                      <div className="flex justify-between items-center group">
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="font-mono text-sm font-medium text-ink break-words">
                            {field.value ||
                              "—"}
                          </span>

                          {fieldType ===
                            "date" &&
                            field.value &&
                            !checkFieldOk(
                              field.value,
                              "date",
                            ) && (
                              <span className="text-[10px] text-red-600 font-mono">
                                ⚠ Future or invalid date
                              </span>
                            )}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setEditedKeys(
                              (
                                previous,
                              ) => ({
                                ...previous,
                                [field.key]: true,
                              }),
                            )
                          }
                          className="opacity-0 group-hover:opacity-100 text-xs text-primary hover:underline font-mono px-2 py-0.5 rounded transition-all"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                );
              },
            )}
          </div>
        </div>

        {/* Validation Status */}
        <div>
          <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-inksoft mb-3">
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
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>

            Validation Status
          </span>

          <div className="border border-line rounded-2xl p-5 bg-white">
            <ul>
              {liveValidation.map(
                (field, index) => (
                  <li
                    key={field.key}
                    className={`flex gap-3 items-center py-3 ${
                      index <
                      liveValidation.length -
                        1
                        ? "border-b border-line/70"
                        : ""
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        field.ok
                          ? "bg-emerald-100"
                          : "bg-red-100"
                      }`}
                    >
                      {field.ok ? (
                        <svg
                          className="w-3.5 h-3.5 text-emerald-600"
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
                          className="w-3.5 h-3.5 text-red-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      )}
                    </div>

                    <span className="text-sm text-ink flex-1">
                      {field.label}{" "}
                      <span className="text-inksoft">
                        {field.ok
                          ? field.isEdited
                            ? "— filled by user"
                            : "— found"
                          : field.type ===
                            "date"
                            ? "— future or invalid date"
                            : "— missing or invalid"}
                      </span>
                    </span>
                  </li>
                ),
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Status badge */}
      <div className="mt-7 flex items-center gap-3 flex-wrap">
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-full ${
            allValid
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {allValid ? (
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

          {allValid
            ? "Ready for Review"
            : "Needs Review"}
        </span>

        {downloadError && (
          <span className="text-xs text-red-500 font-mono">
            {downloadError}
          </span>
        )}
      </div>

      {/* Email message */}
      {emailMessage && (
        <p className="text-xs text-inksoft font-mono mt-3">
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
            className="flex-1 border border-line rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:border-primary disabled:bg-slate-50"
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
        {/* Email */}
        <button
          type="button"
          onClick={() =>
            setShowEmail(
              (previous) =>
                !previous,
            )
          }
          className={`border rounded-xl px-5 py-3 text-sm font-semibold transition-colors ${
            showEmail
              ? "border-primary bg-primary/5 text-primary"
              : "border-line text-ink hover:border-primary hover:text-primary"
          }`}
        >
          Email PDF
        </button>

        {/* Process another */}
        <button
          type="button"
          onClick={
            onAnother
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
              d="M12 4v16m8-8H4"
            />
          </svg>

          Process Another Document
        </button>

        {/* Download */}
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
            : "Download Updated PDF"}
        </button>

        {/* Back */}
        <button
          type="button"
          onClick={
            onBackToPreview
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
              d="M11 17l-5-5m0 0l5-5m-5 5h12"
            />
          </svg>

          Back to preview
        </button>
      </div>
    </div>
  );
}