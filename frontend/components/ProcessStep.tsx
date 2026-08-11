import { IndustryMeta } from "@/lib/types";

export default function ProcessStep({
  meta,
  pdfUrl,
  sourceLabel,
  processing,
  error,
  onBack,
  onProcess,
}: {
  meta: IndustryMeta;
  pdfUrl: string;
  sourceLabel: string;
  processing: boolean;
  error: string | null;
  onBack: () => void;
  onProcess: () => void;
}) {
  return (
    <div className="animate-fade-in">
      <h2 className="font-display font-semibold text-xl text-ink mb-1">{meta.doc_title}</h2>
      <p className="text-inksoft text-sm mb-7 flex items-center gap-2">
        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span className="font-mono text-xs">{sourceLabel}</span>
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-inksoft mb-3">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            PDF Preview
          </span>
          <div className="border border-line rounded-2xl bg-slate-50 h-[380px] overflow-hidden">
            <embed src={pdfUrl} type="application/pdf" className="w-full h-full rounded-2xl" />
          </div>
        </div>
        <div>
          <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-inksoft mb-3">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Expected Fields
          </span>
          <div className="border border-line rounded-2xl h-[380px] p-5 overflow-auto bg-white">
            {meta.fields.map((f, i) => (
              <div key={f.key} className={`py-3.5 ${i < meta.fields.length - 1 ? "border-b border-line/70" : ""}`}>
                <div className="text-inksoft text-xs font-medium uppercase tracking-wide">{f.label}</div>
                <div className="font-mono text-sm text-slate-300 mt-1.5 italic">Awaiting extraction…</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mt-5 rounded-xl">
          <svg className="w-5 h-5 flex-shrink-0 text-red-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-mono text-xs leading-relaxed">{error}</span>
        </div>
      )}

      <div className="flex justify-between mt-8 items-center">
        <button onClick={onBack} className="btn-ghost flex items-center gap-1.5 font-medium text-sm px-4 py-2 rounded-lg">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          Back
        </button>
        <button
          onClick={onProcess}
          disabled={processing}
          className="btn-gradient font-semibold text-sm px-6 py-3 rounded-xl flex items-center gap-2"
        >
          {processing ? (
            <>
              <div className="spinner !w-4 !h-4 !border-2 !border-white/30 !border-t-white" />
              Processing…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Process Document
            </>
          )}
        </button>
      </div>
    </div>
  );
}
