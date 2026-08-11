import { useRef } from "react";
import { IndustryKey, IndustryMeta } from "@/lib/types";

export default function UploadStep({
  industry,
  meta,
  error,
  onBack,
  onFile,
  onUseDemo,
  onUseNegative,
}: {
  industry: IndustryKey;
  meta: IndustryMeta;
  error: string | null;
  onBack: () => void;
  onFile: (file: File) => void;
  onUseDemo: () => void;
  onUseNegative: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="animate-fade-in">
      <h2 className="font-display font-semibold text-xl text-ink mb-1">{meta.label} document</h2>
      <p className="text-inksoft text-sm mb-7 max-w-md leading-relaxed">
        Upload a PDF, or use a preloaded demo document for this industry.
      </p>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-5 rounded-xl">
          <svg className="w-5 h-5 flex-shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      <div
        onClick={() => inputRef.current?.click()}
        className="dropzone-hover border-2 border-dashed border-slate-300 rounded-2xl text-center py-14 px-6 text-inksoft text-sm cursor-pointer mb-5"
      >
        <div className="w-14 h-14 rounded-2xl bg-primarysoft flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <span className="block font-display font-medium text-base text-ink mb-1.5">
          Drop a PDF here or click to browse
        </span>
        <span className="text-xs text-slate-400">PDF files only — other formats will be rejected</span>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </div>

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">or use a demo</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      <div className="flex gap-3 justify-center flex-wrap mb-2">
        <button
          onClick={onUseDemo}
          className="border border-line rounded-xl font-medium text-sm px-5 py-2.5 hover:border-primary hover:text-primary hover:bg-primarysoft transition-all duration-200"
        >
          <svg className="inline-block w-4 h-4 mr-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Use Demo PDF
        </button>
        <button
          onClick={onUseNegative}
          className="border border-line rounded-xl font-medium text-sm px-5 py-2.5 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50 transition-all duration-200"
        >
          <svg className="inline-block w-4 h-4 mr-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          Use Negative Test PDF
        </button>
      </div>

      <div className="flex justify-start mt-8">
        <button onClick={onBack} className="btn-ghost flex items-center gap-1.5 font-medium text-sm px-4 py-2 rounded-lg">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          Back
        </button>
      </div>
    </div>
  );
}
