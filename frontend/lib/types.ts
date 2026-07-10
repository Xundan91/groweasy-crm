export type CsvPreviewRow = Record<string, string>;

export type CrmRecord = {
  created_at: string;
  name: string;
  email: string;
  country_code: string;
  mobile_without_country_code: string;
  company: string;
  city: string;
  state: string;
  country: string;
  lead_owner: string;
  crm_status: string;
  crm_note: string;
  data_source: string;
  possession_time: string;
  description: string;
};

export type SkippedRecord = {
  rowNumber: number;
  reason: string;
  original: CsvPreviewRow;
};

export type ImportResponse = {
  totalRows: number;
  totalImported: number;
  totalSkipped: number;
  usedAi: boolean;
  records: CrmRecord[];
  skipped: SkippedRecord[];
};
