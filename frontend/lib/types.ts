export type FieldType = "text" | "date" | "number";

export interface FieldDef {
  id?: number;
  key: string;
  label: string;
  type: FieldType;
  position?: number;
  active?: boolean;
}

export interface IndustryMeta {
  label: string;
  doc_title: string;
  fields: FieldDef[];
}

export type IndustryKey = "insurance" | "finance" | "healthcare";

export interface ValidationField {
  key: string;
  label: string;
  value: string;
  ok: boolean;
  status?: "valid" | "missing" | "invalid";
}

export interface ProcessResult {
  industry: IndustryKey;
  extracted: Record<string, string>;
  validation: ValidationField[];
  overall: "ready" | "review";
  ai_provider?: string;
  fallback_used?: boolean;
}

export interface SessionRecord extends ProcessResult {
  id: string;
  sourceLabel: string;
  docTitle: string;
  industryLabel: string;
}
