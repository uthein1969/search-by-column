export type SearchMode = 'nrc' | 'phone' | 'fuzzy';

export const ALL_SHEETS_TAB_ID = '__ALL_SHEETS__';
export const ALL_COLUMNS_KEY = '__ALL_COLUMNS__';

export interface ColumnInfo {
  name: string;
  detectedMode: SearchMode;
  sampleValues: string[];
}

export interface MatchResult {
  row: Record<string, any>;
  rowIndex: number;
  sheetName?: string;
  matchedColumn?: string;
  matched: boolean;
  score: number; // 0 to 100
  matchReason?: string;
  matchedSnippet?: string;
  highlightText?: string;
}

export interface SheetDetail {
  name: string;
  columns: string[];
  columnInfos: ColumnInfo[];
  rows: Record<string, any>[];
}

export interface ExcelWorkbookData {
  fileName: string;
  sheetNames: string[];
  activeSheetName: string;
  sheets: Record<string, SheetDetail>;
}
