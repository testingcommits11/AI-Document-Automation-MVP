"use client";

import { useState } from "react";
import { FieldType, IndustryMeta, ProcessResult } from "@/lib/types";
import { exportUpdatedPdf } from "@/lib/api";

function checkFieldOk(val: string, type: FieldType = "text"): boolean {
  const trimmed = (val || "").trim();
  if (!trimmed) return false;
  if (type === "number") return /[\d.,$]/.test(trimmed);
  if (type === "date") return /\d/.test(trimmed);
  return true;
}

function formatToIsoDate(val: string): string {
  if (!val) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  const parsed = Date.parse(val);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return "";
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
  onResultUpdate?: (updated: ProcessResult) => void;
}) {
  // Store values for each field
  const [fieldsState, setFieldsState] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const item of result.validation) {
      initial[item.key] = item.value || "";
    }
    return initial;
  });

  const [editedKeys, setEditedKeys] = useState<Record<string, boolean>>({});
  const [editAll, setEditAll] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Helper to get field type from industry meta
  const getFieldType = (key: string): FieldType => {
    const f = meta.fields.find((field) => field.key === key);
    return f ? f.type : "text";
  };

  // Compute live validation list
  const liveValidation = result.validation.map((f) => {
    const currentValue = fieldsState[f.key] ?? f.value ?? "";
    const fType = getFieldType(f.key);
    const ok = checkFieldOk(currentValue, fType);
    const isEdited = Boolean(editedKeys[f.key]);

    return {
      ...f,
      value: currentValue,
      ok,
      isEdited,
    };
  });

  const allValid = liveValidation.every((f) => f.ok);

  const handleFieldChange = (key: string, newValue: string) => {
    const nextState = { ...fieldsState, [key]: newValue };
    setFieldsState(nextState);
    setEditedKeys((prev) => ({ ...prev, [key]: true }));

    if (onResultUpdate) {
      const updatedValidation = result.validation.map((f) => {
        const val = f.key === key ? newValue : fieldsState[f.key] ?? f.value;
        const fType = getFieldType(f.key);
        return {
          ...f,
          value: val,
          ok: checkFieldOk(val, fType),
        };
      });
      onResultUpdate({
        ...result,
        extracted: nextState,
        validation: updatedValidation,
        overall: updatedValidation.every((v) => v.ok) ? "ready" : "review",
      });
    }
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const blob = await exportUpdatedPdf(result.industry, fieldsState);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${result.industry}_filled_document.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setDownloadError(e.message || "Failed to download PDF");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="animate-fade-in">
       <button
          type="button"
          onClick={onBackToPreview}
          className="btn-ghost flex items-center gap-1.5 font-medium text-sm px-4 py-2 rounded-lg"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          Back to preview
        </button>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h2 className="font-display font-semibold text-xl text-ink">Results — {meta.label}</h2>
        <button
          type="button"
          onClick={() => setEditAll((prev) => !prev)}
          className="text-xs font-mono px-3 py-1.5 rounded-lg border border-line hover:border-primary/40 bg-white text-inksoft hover:text-ink transition-colors flex items-center gap-1.5 self-start sm:self-auto"
        >
          <svg className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          {editAll ? "Done Editing All" : "Edit All Fields"}
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
            allValid ? "bg-emerald-100" : "bg-amber-100"
          }`}
        >
          {allValid ? (
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Extracted info */}
        <div>
          <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-inksoft mb-3">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Extracted Information & Edit Inputs
          </span>
          <div className="border border-line rounded-2xl p-5 bg-white space-y-4">
            {liveValidation.map((f, i) => {
              const showInput = editAll || !f.ok || f.isEdited;
              const fType = getFieldType(f.key);

              return (
                <div
                  key={f.key}
                  className={`py-2.5 ${i < liveValidation.length - 1 ? "border-b border-line/70" : ""}`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor={`input-${f.key}`} className="text-inksoft text-xs font-medium flex items-center gap-1.5">
                      {f.label}
                      {fType === "date" && <span className="text-[10px] text-inksoft/60 font-mono">(date)</span>}
                      {fType === "number" && <span className="text-[10px] text-inksoft/60 font-mono">(number)</span>}
                    </label>
                    {f.isEdited && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                        user filled
                      </span>
                    )}
                  </div>

                  {showInput ? (
                    <div className="mt-1">
                      {fType === "date" ? (
                        <div className="flex flex-col gap-1">
                          <input
                            id={`input-${f.key}`}
                            type="date"
                            value={formatToIsoDate(f.value)}
                            onChange={(e) => handleFieldChange(f.key, e.target.value)}
                            className={`w-full text-sm font-mono px-3 py-2 rounded-xl border outline-none transition-all cursor-pointer ${
                              !f.ok
                                ? "border-amber-300 bg-amber-50/60 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-200 text-amber-900"
                                : "border-line bg-slate-50/50 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 text-ink"
                            }`}
                          />
                          {f.value && !/^\d{4}-\d{2}-\d{2}$/.test(f.value) && (
                            <span className="text-[11px] text-inksoft font-mono">
                              Current value: <span className="font-semibold text-ink">{f.value}</span>
                            </span>
                          )}
                        </div>
                      ) : fType === "number" ? (
                        <input
                          id={`input-${f.key}`}
                          type="text"
                          inputMode="decimal"
                          value={f.value}
                          onChange={(e) => handleFieldChange(f.key, e.target.value)}
                          placeholder={`Enter ${f.label.toLowerCase()} (e.g. 250 or $250)…`}
                          className={`w-full text-sm font-mono px-3 py-2 rounded-xl border outline-none transition-all ${
                            !f.ok
                              ? "border-amber-300 bg-amber-50/60 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-200 text-amber-900 placeholder-amber-400"
                              : "border-line bg-slate-50/50 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 text-ink"
                          }`}
                        />
                      ) : (
                        <input
                          id={`input-${f.key}`}
                          type="text"
                          value={f.value}
                          onChange={(e) => handleFieldChange(f.key, e.target.value)}
                          placeholder={`Fill missing ${f.label.toLowerCase()}…`}
                          className={`w-full text-sm font-mono px-3 py-2 rounded-xl border outline-none transition-all ${
                            !f.ok
                              ? "border-amber-300 bg-amber-50/60 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-200 text-amber-900 placeholder-amber-400"
                              : "border-line bg-slate-50/50 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 text-ink"
                          }`}
                        />
                      )}
                      {!f.ok && (
                        <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1 font-sans">
                          ⚠️ Missing or invalid data — enter a value to complete validation
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex justify-between items-center group">
                      <span className="font-mono text-sm font-medium text-ink">{f.value || "—"}</span>
                      <button
                        type="button"
                        onClick={() => setEditedKeys((prev) => ({ ...prev, [f.key]: true }))}
                        className="opacity-0 group-hover:opacity-100 text-xs text-primary hover:underline font-mono px-2 py-0.5 rounded transition-all"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Validation Status */}
        <div>
          <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-inksoft mb-3">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Validation Status
          </span>
          <div className="border border-line rounded-2xl p-5 bg-white">
            <ul>
              {liveValidation.map((f, i) => (
                <li key={f.key} className={`flex gap-3 items-center py-3 ${i < liveValidation.length - 1 ? "border-b border-line/70" : ""}`}>
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      f.ok ? "bg-emerald-100" : "bg-red-100"
                    }`}
                  >
                    {f.ok ? (
                      <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-ink flex-1">
                    {f.label}{" "}
                    <span className="text-inksoft">
                      {f.ok
                        ? f.isEdited
                          ? "— filled by user"
                          : "— found"
                        : "— missing or invalid"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Status badge */}
      <div className="mt-7 flex items-center gap-3">
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-full ${
            allValid
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {allValid ? (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01" />
            </svg>
          )}
          {allValid ? "Ready for Review" : "Needs Review"}
        </span>

        {downloadError && (
          <span className="text-xs text-red-500 font-mono">{downloadError}</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-7 flex-wrap items-center">
        <button
          type="button"
          onClick={onAnother}
          className="btn-gradient font-semibold text-sm px-6 py-3 rounded-xl flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Process Another Document
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
          {downloading ? "Generating PDF…" : "Download Updated PDF"}
        </button>

        <button
          type="button"
          onClick={onBackToPreview}
          className="btn-ghost flex items-center gap-1.5 font-medium text-sm px-4 py-2 rounded-lg"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          Back to preview
        </button>
      </div>
    </div>
  );
}
