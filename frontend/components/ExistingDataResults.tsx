"use client";

import { useState } from "react";
import { FieldType, IndustryMeta, ProcessResult } from "@/lib/types";
import { exportUpdatedPdf } from "@/lib/api";

type FieldStatus = "valid" | "missing" | "invalid";

function computeStatus(value: string, type: FieldType): FieldStatus {
  const trimmed = (value || "").trim();
  if (!trimmed) return "missing";
  if (type === "number" && !/[\d.,$]/.test(trimmed)) return "invalid";
  if (type === "date" && !/\d/.test(trimmed)) return "invalid";
  return "valid";
}

function buildInitial(meta: IndustryMeta, result: ProcessResult): Record<string, string> {
  const initial: Record<string, string> = {};
  for (const f of meta.fields) {
    const match = result.validation.find((v) => v.key === f.key);
    initial[f.key] = match?.value || "";
  }
  return initial;
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
  // What the user is currently typing — editing this does NOT recompute
  // status badges. Nothing is checked until "Validate & Update" is clicked.
  const [fieldsState, setFieldsState] = useState<Record<string, string>>(() => buildInitial(meta, result));

  // Snapshot that status/badges are computed from. Only replaced when the
  // user explicitly clicks "Validate & Update" — so no live validation.
  const [validatedState, setValidatedState] = useState<Record<string, string>>(() => buildInitial(meta, result));

  // Whether the user has explicitly hit "Validate & Update" at least once.
  const [reviewed, setReviewed] = useState(false);

  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const live = meta.fields.map((f) => {
    const value = validatedState[f.key] ?? "";
    return { ...f, value, status: computeStatus(value, f.type) };
  });

  const complete = live.every((f) => f.status === "valid");
  const missingCount = live.filter((f) => f.status === "missing").length;
  const invalidCount = live.filter((f) => f.status === "invalid").length;

  function handleChange(key: string, value: string) {
    setFieldsState((prev) => ({ ...prev, [key]: value }));
  }

  function handleValidateAndUpdate() {
    setValidatedState(fieldsState);
    setReviewed(true);
  }

  async function handleDownloadPdf() {
    setDownloading(true);
    setDownloadError(null);
    try {
      const blob = await exportUpdatedPdf(result.industry, fieldsState);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${result.industry}_updated_document.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setDownloadError(e.message || "Failed to download PDF.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="animate-fade-in">
       <button type="button" onClick={onBack} className="btn-ghost flex items-center gap-1.5 font-medium text-sm px-4 py-2 rounded-lg">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          Back
        </button>
      <h2 className="font-display font-semibold text-xl text-ink mb-1">Existing Data Validation</h2>
      <p className="text-inksoft text-sm mb-1 max-w-md leading-relaxed">
        {meta.label} — {meta.doc_title}
      </p>
      <p className="text-inksoft text-xs font-mono mb-6">Source: {sourceLabel}</p>

      {/* Overall status banner */}
      <div
        className={`flex items-center gap-3 px-5 py-4 mb-7 rounded-xl text-sm font-medium transition-all ${
          complete
            ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
            : "bg-amber-50 border border-amber-200 text-amber-700"
        }`}
      >
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            complete ? "bg-emerald-100" : "bg-amber-100"
          }`}
        >
          {complete ? (
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          )}
        </div>
        <div>
          <p className="font-semibold">Overall Status: {complete ? "✓ Complete" : "⚠ Incomplete"}</p>
          {!complete && (
            <p className="text-xs font-normal text-amber-600/90 mt-0.5">
              {missingCount > 0 && `${missingCount} field${missingCount > 1 ? "s" : ""} missing`}
              {missingCount > 0 && invalidCount > 0 && " · "}
              {invalidCount > 0 && `${invalidCount} field${invalidCount > 1 ? "s" : ""} look incorrect or inconsistent`}
              {" "}— fill or correct them below.
            </p>
          )}
        </div>
      </div>

      {/* Field list */}
      <div className="border border-line rounded-2xl p-5 bg-white space-y-5">
        {live.map((f, i) => (
          <div key={f.key} className={`pb-5 ${i < live.length - 1 ? "border-b border-line/70" : "pb-0"}`}>
            <div className="text-inksoft text-xs font-medium mb-1.5">{f.label}</div>

            {f.status === "valid" && (
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-medium text-ink">{f.value}</span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Available
                </span>
              </div>
            )}

            {f.status === "missing" && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm text-slate-400 italic">[ Missing ]</span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                    ⚠ Required
                  </span>
                </div>
                <input
                  type="text"
                  value={fieldsState[f.key] ?? ""}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  placeholder={`Enter ${f.label}`}
                  className="w-full text-sm font-mono px-3 py-2 rounded-xl border border-amber-300 bg-amber-50/60 outline-none focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-200 text-amber-900 placeholder-amber-400 transition-all"
                />
              </div>
            )}

            {f.status === "invalid" && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm text-red-500 line-through decoration-red-300">{f.value}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2.5 py-1">
                    ⚠ Incorrect / Inconsistent
                  </span>
                </div>
                <input
                  type="text"
                  value={fieldsState[f.key] ?? ""}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  placeholder={`Correct ${f.label}`}
                  className="w-full text-sm font-mono px-3 py-2 rounded-xl border border-red-300 bg-red-50/60 outline-none focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-200 text-red-900 placeholder-red-400 transition-all"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {reviewed && (
        <p className="text-xs font-mono text-inksoft mt-3">
          {complete ? "✓ Validated — all fields check out." : "Checked current values — some fields still need attention."}
        </p>
      )}
      {!reviewed && (
        <p className="text-xs font-mono text-slate-400 mt-3">
          Edits above won't be checked until you click "Validate & Update".
        </p>
      )}
      {downloadError && <p className="text-xs text-red-500 font-mono mt-2">{downloadError}</p>}

      <div className="flex gap-3 mt-7 flex-wrap items-center">
        <button
          type="button"
          onClick={handleValidateAndUpdate}
          className="btn-gradient font-semibold text-sm px-6 py-3 rounded-xl flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Validate & Update
        </button>

        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={downloading}
          className="bg-slate-900 hover:bg-slate-800 active:bg-black text-white font-medium text-sm px-5 py-3 rounded-xl flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
        >
          {downloading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          )}
          {downloading ? "Generating PDF…" : "Download PDF"}
        </button>

        <button type="button" onClick={onStartOver} className="btn-ghost flex items-center gap-1.5 font-medium text-sm px-4 py-2 rounded-lg">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Validate Another Document
        </button>

        <button type="button" onClick={onBack} className="btn-ghost flex items-center gap-1.5 font-medium text-sm px-4 py-2 rounded-lg">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          Back
        </button>
      </div>
    </div>
  );
}
