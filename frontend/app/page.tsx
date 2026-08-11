"use client";

import { useEffect, useState } from "react";
import Stepper from "@/components/Stepper";
import IndustrySelect from "@/components/IndustrySelect";
import UploadStep from "@/components/UploadStep";
import ProcessStep from "@/components/ProcessStep";
import ResultsStep from "@/components/ResultsStep";
import SessionList from "@/components/SessionList";
import { fetchIndustries, fetchDemoPdf, processDocument } from "@/lib/api";
import { IndustryKey, IndustryMeta, ProcessResult, SessionRecord } from "@/lib/types";

export default function Home() {
  const [industries, setIndustries] = useState<Record<IndustryKey, IndustryMeta> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [screen, setScreen] = useState(1);
  const [industry, setIndustry] = useState<IndustryKey | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);

  const [sessionResults, setSessionResults] = useState<SessionRecord[]>([]);

  useEffect(() => {
    fetchIndustries()
      .then(setIndustries)
      .catch((e) => setLoadError(e.message));
  }, []);

  function resetDocumentState() {
    setPdfBlob(null);
    setPdfUrl("");
    setResult(null);
    setProcessError(null);
    setUploadError(null);
  }

  function goToUpload() {
    setScreen(2);
  }

  function handleFile(file: File) {
    if (file.type !== "application/pdf") {
      setUploadError("Unsupported file type. Please upload a PDF.");
      return;
    }
    setUploadError(null);
    setPdfBlob(file);
    setPdfUrl(URL.createObjectURL(file));
    setSourceLabel(file.name);
    setResult(null);
    setScreen(3);
  }

  async function handleUseDemo(negative: boolean) {
    if (!industry) return;
    try {
      const blob = await fetchDemoPdf(industry, negative);
      setPdfBlob(blob);
      setPdfUrl(URL.createObjectURL(blob));
      setSourceLabel(`${industry}_${negative ? "negative_test" : "demo"}.pdf`);
      setUploadError(null);
      setResult(null);
      setScreen(3);
    } catch (e: any) {
      setUploadError(e.message);
    }
  }

  async function handleProcess() {
    if (!industry || !pdfBlob || !industries) return;
    setProcessing(true);
    setProcessError(null);
    try {
      const res = await processDocument(industry, pdfBlob, sourceLabel || "document.pdf");
      setResult(res);
      const meta = industries[industry];
      setSessionResults((prev) => [
        {
          ...res,
          id: crypto.randomUUID(),
          sourceLabel,
          docTitle: meta.doc_title,
          industryLabel: meta.label,
        },
        ...prev,
      ]);
      setScreen(4);
    } catch (e: any) {
      setProcessError(
        `Processing failed: ${e.message}. This can happen if the AI or PDF extraction step is unavailable — try again.`
      );
    } finally {
      setProcessing(false);
    }
  }

  function handleResultUpdate(updated: ProcessResult) {
    setResult(updated);
    setSessionResults((prev) =>
      prev.map((rec, idx) => (idx === 0 ? { ...rec, ...updated } : rec))
    );
  }

  function startOver() {
    setScreen(1);
    setIndustry(null);
    resetDocumentState();
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl shadow-card p-8 max-w-md text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="font-mono text-sm text-red-600 mb-2">Connection Error</p>
          <p className="text-inksoft text-sm">
            Could not reach the API ({loadError}). Make sure the backend is running and
            NEXT_PUBLIC_API_BASE_URL is set correctly.
          </p>
        </div>
      </div>
    );
  }

  if (!industries) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="spinner" />
          <span className="text-inksoft text-sm font-mono">Loading…</span>
        </div>
      </div>
    );
  }

  const meta = industry ? industries[industry] : null;

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background orbs */}
      <div className="bg-orb w-[500px] h-[500px] bg-primary/20 -top-[200px] -right-[200px] fixed pointer-events-none" />
      <div className="bg-orb w-[400px] h-[400px] bg-emerald-400/15 -bottom-[150px] -left-[150px] fixed pointer-events-none" style={{ animationDelay: "3s" }} />

      <div className="relative max-w-[1080px] mx-auto px-6 sm:px-8 py-10 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center shadow-glow">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="font-display font-bold text-xl tracking-tight text-ink">AI Document Automation MVP</h1>
              <p className="text-inksoft text-xs mt-0.5">One extraction engine, three industries</p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-inksoft bg-white border border-line rounded-full px-3 py-1.5 shadow-card">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-soft" />
            MVP Demo · Session Only
          </span>
        </div>

        <Stepper current={screen} />

        {/* Main content card */}
        <div className="bg-white rounded-2xl shadow-card border border-line/50 p-6 sm:p-8 animate-fade-in">
          {screen === 1 && (
            <IndustrySelect industries={industries} selected={industry} onSelect={setIndustry} onContinue={goToUpload} />
          )}
          {screen === 2 && industry && meta && (
            <UploadStep
              industry={industry}
              meta={meta}
              error={uploadError}
              onBack={() => setScreen(1)}
              onFile={handleFile}
              onUseDemo={() => handleUseDemo(false)}
              onUseNegative={() => handleUseDemo(true)}
            />
          )}
          {screen === 3 && meta && (
            <ProcessStep
              meta={meta}
              pdfUrl={pdfUrl}
              sourceLabel={sourceLabel}
              processing={processing}
              error={processError}
              onBack={() => setScreen(2)}
              onProcess={handleProcess}
            />
          )}
          {screen === 4 && meta && result && (
            <ResultsStep
              meta={meta}
              result={result}
              onAnother={startOver}
              onBackToPreview={() => setScreen(3)}
              onResultUpdate={handleResultUpdate}
            />
          )}
        </div>

        <SessionList records={sessionResults} />
      </div>
    </div>
  );
}
