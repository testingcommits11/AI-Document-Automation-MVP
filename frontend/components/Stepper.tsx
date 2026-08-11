const STEPS = [
  { n: 1, l: "Industry", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
  { n: 2, l: "Document", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { n: 3, l: "Process", icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" },
  { n: 4, l: "Results", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
];

export default function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center mb-8 gap-1">
      {STEPS.map((s, i) => {
        const idx = i + 1;
        const state = idx < current ? "done" : idx === current ? "active" : "pending";
        const isLast = i === STEPS.length - 1;

        return (
          <div key={s.n} className="flex items-center flex-1 last:flex-none">
            {/* Step node */}
            <div className="flex items-center gap-2.5">
              <div
                className={`relative w-9 h-9 rounded-xl flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
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
                  <span>{s.n}</span>
                )}
              </div>
              <span
                className={`hidden sm:block text-sm font-medium transition-colors ${
                  state === "active"
                    ? "text-ink"
                    : state === "done"
                    ? "text-emerald-600"
                    : "text-slate-400"
                }`}
              >
                {s.l}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div className="flex-1 mx-3 h-0.5 rounded-full overflow-hidden bg-slate-200">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    idx < current ? "bg-emerald-400 w-full" : "w-0"
                  }`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
