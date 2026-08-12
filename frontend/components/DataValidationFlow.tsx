"use client";

import { useState } from "react";
import IndustrySelect from "./IndustrySelect";
import UploadStep from "./UploadStep";
import ExistingDataResults from "./ExistingDataResults";
import { fetchDemoPdf, processDocument } from "@/lib/api";
import { IndustryKey, IndustryMeta, ProcessResult } from "@/lib/types";

const STEP_LABELS = ["Industry", "Document", "Validation"];

function MiniStepper({ current }: { current: number }) {
  return (
    <div className="flex items-center mb-8 gap-1">
      {STEP_LABELS.map((label, i) => {
        const idx = i + 1;
        const state = idx < current ? "done" : idx === current ? "active" : "pending";
        const isLast = i === STEP_LABELS.length - 1;
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
                  state === "active"
                    ? "bg-gradient-to-br from-primary to-purple-500 text-white shadow-glow"
                    : state === "done"
                    ? "bg-emerald-50 text-emerald-600 border-2 border-emerald-200"
                    : "bg-slate-100 text-slate-400 border-2 border-slate-200"
                }`}
              >
                {state === "done" ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span>{idx}</span>
                )}
              </div>
              <span
                className={`hidden sm:block text-sm font-medium ${
                  state === "active" ? "text-ink" : state === "done" ? "text-emerald-600" : "text-slate-400"
                }`}
              >
                {label}
              </span>
            </div>
            {!isLast && (
              <div className="flex-1 mx-3 h-0.5 rounded-full overflow-hidden bg-slate-200">
                <div className={`h-full rounded-full transition-all duration-500 ${idx < current ? "bg-emerald-400 w-full" : "w-0"}`} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function DataValidationFlow({
  industries,
}: {
  industries: Record<IndustryKey, IndustryMeta>;
}) {
  const [step, setStep] = useState(1);
  const [industry, setIndustry] = useState<IndustryKey | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [sourceLabel, setSourceLabel] = useState("");

  const meta = industry ? industries[industry] : null;

  function reset() {
    setStep(1);
    setIndustry(null);
    setUploadError(null);
    setProcessError(null);
    setResult(null);
    setSourceLabel("");
  }

  async function runValidation(ind: IndustryKey, file: File | Blob, filename: string) {
    setProcessing(true);
    setProcessError(null);
    setStep(3);
    try {
      const res = await processDocument(ind, file, filename);
      setResult(res);
    } catch (e: any) {
      setProcessError(
        `Could not validate this document: ${e.message}. This can happen if the AI or PDF extraction step is unavailable — try again.`
      );
    } finally {
      setProcessing(false);
    }
  }

  function handleFile(file: File) {
    if (file.type !== "application/pdf") {
      setUploadError("Unsupported file type. Please upload a PDF.");
      return;
    }
    if (!industry) return;
    setUploadError(null);
    setSourceLabel(file.name);
    runValidation(industry, file, file.name);
  }

  async function handleUseDemo(negative: boolean) {
    if (!industry) return;
    try {
      const blob = await fetchDemoPdf(industry, negative);
      const filename = `${industry}_${negative ? "negative_test" : "demo"}.pdf`;
      setUploadError(null);
      setSourceLabel(filename);
      runValidation(industry, blob, filename);
    } catch (e: any) {
      setUploadError(e.message);
    }
  }

  return (
    <div>
      <MiniStepper current={step} />

      <div className="bg-white rounded-2xl shadow-card border border-line/50 p-6 sm:p-8">
        {step === 1 && (
          <IndustrySelect
            industries={industries}
            selected={industry}
            onSelect={setIndustry}
            onContinue={() => setStep(2)}
          />
        )}

        {step === 2 && industry && meta && (
          <UploadStep
            industry={industry}
            meta={meta}
            error={uploadError}
            onBack={() => setStep(1)}
            onFile={handleFile}
            onUseDemo={() => handleUseDemo(false)}
            onUseNegative={() => handleUseDemo(true)}
          />
        )}

        {step === 3 && meta && (
          <div>
            {processing && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="spinner" />
                <span className="text-inksoft text-sm font-mono">
                  Reading the document and checking it against required fields…
                </span>
              </div>
            )}

            {!processing && processError && (
              <div>
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-5 rounded-xl">
                  <svg className="w-5 h-5 flex-shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {processError}
                </div>
                <button onClick={() => setStep(2)} className="btn-ghost font-medium text-sm px-4 py-2 rounded-lg">
                  ← Back
                </button>
              </div>
            )}

            {!processing && !processError && result && (
              <ExistingDataResults meta={meta} result={result} sourceLabel={sourceLabel} onStartOver={reset} onBack={() => setStep(2)} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
