import { SessionRecord } from "@/lib/types";

export default function SessionList({ records }: { records: SessionRecord[] }) {
  return (
    <div className="mt-14">
      <div className="flex items-center gap-3 mb-5">
        <h3 className="font-display font-semibold text-lg text-ink">Processed Documents</h3>
        {records.length > 0 && (
          <span className="bg-primarysoft text-primary text-xs font-semibold px-2.5 py-0.5 rounded-full">
            {records.length}
          </span>
        )}
      </div>
      <p className="font-mono text-[11px] text-inksoft mb-5">
        Kept only for this page session — refreshing clears this list. No database, no persistence.
      </p>

      {records.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-inksoft text-sm">Nothing processed yet this session</p>
          <p className="text-slate-400 text-xs mt-1">Documents will appear here after processing</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((r, i) => {
            const good = r.overall === "ready";
            return (
              <div
                key={r.id}
                className="card-lift bg-white border border-line/70 rounded-xl px-5 py-4 flex justify-between items-start gap-4 shadow-card animate-fade-in"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-mono text-slate-400">#{records.length - i}</span>
                    <span className="text-xs text-slate-300">·</span>
                    <span className="text-sm font-medium text-ink truncate">{r.industryLabel}</span>
                    <span className="text-xs text-slate-300">·</span>
                    <span className="text-xs text-inksoft truncate">{r.docTitle}</span>
                  </div>
                  <div className="text-xs text-inksoft leading-relaxed truncate">
                    {r.validation.map((f) => `${f.label}: ${f.value || "—"}`).join(" · ")}
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap px-3 py-1 rounded-full flex-shrink-0 ${
                    good
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-amber-50 text-amber-600"
                  }`}
                >
                  {good ? (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01" />
                    </svg>
                  )}
                  {good ? "Valid" : "Review"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
