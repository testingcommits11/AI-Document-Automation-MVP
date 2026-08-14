export type IndustryKey = string;

export type FieldType =
  | "text"
  | "date"
  | "number";

export interface FieldDefinition {
  id: number;
  industry: IndustryKey;
  key: string;
  label: string;
  type: FieldType;
  is_default: boolean;
  user_id?: number | null;
  is_active?: boolean;
}

export interface IndustryMeta {
  label: string;
  doc_title: string;
  fields: FieldDefinition[];
}

export interface ValidationField {
  key: string;
  label: string;
  type?: FieldType;
  value: string;
  status: "valid" | "missing" | "invalid";
  message?: string;
  is_default?: boolean;
}

export interface ProcessResult {
  industry: IndustryKey;
  extracted: Record<string, string>;
  validation: ValidationField[];
  overall: string;
  ai_provider?: string;
  fallback_used?: boolean;
}

export interface SessionRecord
  extends ProcessResult {
  id: string;
  sourceLabel: string;
  docTitle: string;
  industryLabel: string;
}

export interface AuthUser {
  id: number;
  email: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}