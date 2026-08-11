import { IndustryKey, IndustryMeta } from "@/lib/types";

const ACCENTS: Record<IndustryKey, { border: string; tint: string; dot: string; icon: string }> = {
  insurance: {
    border: "border-l-indigo-500",
    tint: "bg-indigo-50/80",
    dot: "bg-indigo-500",
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  },
  finance: {
    border: "border-l-emerald-500",
    tint: "bg-emerald-50/80",
    dot: "bg-emerald-500",
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  healthcare: {
    border: "border-l-rose-500",
    tint: "bg-rose-50/80",
    dot: "bg-rose-500",
    icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  },
};

export default function IndustrySelect({
  industries,
  selected,
  onSelect,
  onContinue,
}: {
  industries: Record<IndustryKey, IndustryMeta>;
  selected: IndustryKey | null;
  onSelect: (k: IndustryKey) => void;
  onContinue: () => void;
}) {
  return (
    <div>
      <h2 className="font-display font-semibold text-xl text-ink mb-1">Select an industry</h2>
      <p className="text-inksoft text-sm mb-7 max-w-md leading-relaxed">
        The selected industry determines the expected document type and the fields the engine looks for.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {(Object.keys(industries) as IndustryKey[]).map((key) => {
          const meta = industries[key];
          const accent = ACCENTS[key];
          const isSel = selected === key;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={`group text-left border rounded-2xl p-5 transition-all duration-200 border-l-[3px] ${
                isSel
                  ? `${accent.border} ${accent.tint} shadow-card-hover scale-[1.02]`
                  : `border-line ${accent.border.replace("border-l-", "hover:border-l-")} hover:shadow-card bg-white`
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                    isSel ? `${accent.tint} shadow-sm` : "bg-slate-50 group-hover:bg-slate-100"
                  }`}
                >
                  <svg
                    className={`w-5 h-5 transition-colors ${isSel ? "text-ink" : "text-slate-400 group-hover:text-slate-600"}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={accent.icon} />
                  </svg>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                    isSel ? "border-transparent" : "border-slate-300"
                  }`}
                >
                  {isSel && (
                    <div className={`w-5 h-5 rounded-full ${accent.dot} flex items-center justify-center`}>
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
              <span className="block font-semibold text-[15px] text-ink mb-1">{meta.label}</span>
              <span className="block text-xs text-inksoft leading-relaxed">{meta.doc_title}</span>
            </button>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          disabled={!selected}
          onClick={onContinue}
          className="btn-gradient font-semibold text-sm px-6 py-3 rounded-xl"
        >
          Continue
          <svg className="inline-block w-4 h-4 ml-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
