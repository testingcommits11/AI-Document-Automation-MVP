export type FieldType = "text" | "date" | "number";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
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
}

export interface ProcessResult {
  industry: IndustryKey;
  extracted: Record<string, string>;
  validation: ValidationField[];
  overall: "ready" | "review";
}

export interface SessionRecord extends ProcessResult {
  id: string;
  sourceLabel: string;
  docTitle: string;
  industryLabel: string;
}
