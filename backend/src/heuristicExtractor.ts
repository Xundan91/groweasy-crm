import {
  CRM_STATUSES,
  DATA_SOURCES,
  type CrmRecord,
  type CrmStatus,
  type CsvRow,
  type DataSource,
  type SkippedRecord
} from "./types.js";

const EMPTY_RECORD: CrmRecord = {
  created_at: "",
  name: "",
  email: "",
  country_code: "",
  mobile_without_country_code: "",
  company: "",
  city: "",
  state: "",
  country: "",
  lead_owner: "",
  crm_status: "",
  crm_note: "",
  data_source: "",
  possession_time: "",
  description: ""
};

const FIELD_HINTS: Record<keyof CrmRecord, string[]> = {
  created_at: ["created at", "created", "date", "timestamp", "lead date", "submitted", "time"],
  name: ["name", "full name", "lead name", "customer", "client", "contact person"],
  email: ["email", "mail", "e-mail"],
  country_code: ["country code", "dial code", "phone code", "isd"],
  mobile_without_country_code: ["mobile", "phone", "contact", "telephone", "whatsapp", "number"],
  company: ["company", "organization", "organisation", "business", "agency"],
  city: ["city", "location city", "town"],
  state: ["state", "province", "region"],
  country: ["country", "nation"],
  lead_owner: ["owner", "assignee", "sales rep", "assigned to", "lead owner"],
  crm_status: ["status", "stage", "lead status", "disposition", "quality"],
  crm_note: ["note", "remark", "comment", "message", "feedback", "follow up"],
  data_source: ["source", "campaign", "project", "property", "ad set", "form"],
  possession_time: ["possession", "move in", "handover", "timeline"],
  description: ["description", "requirements", "interest", "details", "query"]
};

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_REGEX = /(?:\+?\d[\d\s().-]{7,}\d)/g;

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function findValue(row: CsvRow, target: keyof CrmRecord) {
  const entries = Object.entries(row);
  const hints = FIELD_HINTS[target];
  const exact = entries.find(([key]) => hints.includes(normalizeHeader(key)));
  if (exact) return exact[1];

  const partial = entries.find(([key]) => {
    const normalized = normalizeHeader(key);
    return hints.some((hint) => normalized.includes(hint));
  });

  return partial?.[1] ?? "";
}

function allText(row: CsvRow) {
  return Object.values(row).filter(Boolean).join(" ");
}

function extractEmails(row: CsvRow) {
  const emailFieldValue = findValue(row, "email");
  const fromEmailFields = emailFieldValue.match(EMAIL_REGEX) ?? [];
  if (fromEmailFields.length > 0) return [...new Set(fromEmailFields)];

  const fromWholeRow = allText(row).match(EMAIL_REGEX) ?? [];
  return [...new Set(fromWholeRow)];
}

function splitPhone(rawPhone: string, row: CsvRow) {
  const configuredCode = normalizeCountryCode(findValue(row, "country_code"));
  const compact = rawPhone.replace(/[^\d+]/g, "");
  const digits = compact.replace(/\D/g, "");

  if (configuredCode) {
    const codeDigits = configuredCode.replace(/\D/g, "");
    const mobile = digits.startsWith(codeDigits) ? digits.slice(codeDigits.length) : digits;
    return { countryCode: configuredCode, mobile: mobile.slice(-12) };
  }

  if (compact.startsWith("+")) {
    if (digits.length > 10) {
      return { countryCode: `+${digits.slice(0, digits.length - 10)}`, mobile: digits.slice(-10) };
    }
    return { countryCode: "", mobile: digits };
  }

  if (digits.length > 10 && digits.startsWith("91")) {
    return { countryCode: "+91", mobile: digits.slice(-10) };
  }

  return { countryCode: "", mobile: digits.slice(-10) };
}

function normalizeCountryCode(value: string) {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

function extractPhones(row: CsvRow) {
  const fieldValue = findValue(row, "mobile_without_country_code");
  const fromPhoneFields = filterPhoneCandidates(fieldValue.match(PHONE_REGEX) ?? []);
  if (fromPhoneFields.length > 0) return [...new Set(fromPhoneFields)];

  const fromWholeRow = filterPhoneCandidates(allText(row).match(PHONE_REGEX) ?? []);
  return [...new Set(fromWholeRow)];
}

function filterPhoneCandidates(values: string[]) {
  return values.filter((value) => {
    const digits = value.replace(/\D/g, "");
    const looksLikeDate = /\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(value);
    return digits.length >= 8 && !looksLikeDate;
  });
}

function normalizeStatus(value: string): CrmStatus {
  const normalized = value.toLowerCase();
  if (!normalized) return "";
  if (CRM_STATUSES.includes(value as Exclude<CrmStatus, "">)) return value as CrmStatus;
  if (/(sale|sold|closed|won|converted)/.test(normalized)) return "SALE_DONE";
  if (/(bad|invalid|junk|not interested|lost|spam)/.test(normalized)) return "BAD_LEAD";
  if (/(not.*connect|did.*connect|unreachable|busy|no answer|callback)/.test(normalized)) {
    return "DID_NOT_CONNECT";
  }
  if (/(good|follow|hot|warm|qualified|interested)/.test(normalized)) {
    return "GOOD_LEAD_FOLLOW_UP";
  }
  return "";
}

function normalizeSource(value: string): DataSource {
  const normalized = value.toLowerCase().replace(/[\s-]+/g, "_");
  return DATA_SOURCES.find((source) => normalized.includes(source)) ?? "";
}

function normalizeDate(value: string) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function buildNote(baseNote: string, extraEmails: string[], extraPhones: string[]) {
  const additions = [
    ...extraEmails.map((email) => `Extra email: ${email}`),
    ...extraPhones.map((phone) => `Extra phone: ${phone}`)
  ];
  return [baseNote, ...additions].filter(Boolean).join(" | ");
}

export function heuristicExtract(rows: CsvRow[], offset = 0) {
  const records: CrmRecord[] = [];
  const skipped: SkippedRecord[] = [];

  rows.forEach((row, index) => {
    const emails = extractEmails(row);
    const phones = extractPhones(row);
    const firstPhone = phones[0] ?? "";
    const phoneParts = firstPhone ? splitPhone(firstPhone, row) : { countryCode: "", mobile: "" };

    if (!emails[0] && !phoneParts.mobile) {
      skipped.push({
        rowNumber: offset + index + 1,
        reason: "Missing both email and mobile number",
        original: row
      });
      return;
    }

    records.push({
      ...EMPTY_RECORD,
      created_at: normalizeDate(findValue(row, "created_at")),
      name: findValue(row, "name"),
      email: emails[0] ?? "",
      country_code: phoneParts.countryCode || normalizeCountryCode(findValue(row, "country_code")),
      mobile_without_country_code: phoneParts.mobile,
      company: findValue(row, "company"),
      city: findValue(row, "city"),
      state: findValue(row, "state"),
      country: findValue(row, "country"),
      lead_owner: findValue(row, "lead_owner"),
      crm_status: normalizeStatus(findValue(row, "crm_status")),
      crm_note: buildNote(findValue(row, "crm_note"), emails.slice(1), phones.slice(1)),
      data_source: normalizeSource(findValue(row, "data_source")),
      possession_time: findValue(row, "possession_time"),
      description: findValue(row, "description")
    });
  });

  return { records, skipped };
}

export function sanitizeRecord(record: Partial<CrmRecord>): CrmRecord | null {
  const safeRecord = { ...EMPTY_RECORD, ...record };
  safeRecord.crm_status = normalizeStatus(safeRecord.crm_status);
  safeRecord.data_source = DATA_SOURCES.includes(safeRecord.data_source as Exclude<DataSource, "">)
    ? safeRecord.data_source
    : "";
  safeRecord.created_at = normalizeDate(safeRecord.created_at) || safeRecord.created_at;
  safeRecord.country_code = normalizeCountryCode(safeRecord.country_code);
  safeRecord.mobile_without_country_code = safeRecord.mobile_without_country_code.replace(/\D/g, "");
  safeRecord.crm_note = safeRecord.crm_note.replace(/\r?\n/g, "\\n");
  safeRecord.description = safeRecord.description.replace(/\r?\n/g, "\\n");

  if (!safeRecord.email && !safeRecord.mobile_without_country_code) {
    return null;
  }

  return safeRecord;
}
