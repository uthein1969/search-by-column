import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { MatchResult, SearchMode, TextMatchOption, ALL_SHEETS_TAB_ID, ALL_COLUMNS_KEY } from '../types';
import {
  Download,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle2,
  Layers,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  FileCode,
  Calculator,
  Sigma,
} from 'lucide-react';
import { parseAmount } from '../utils/numberUtils';
import { detectColumnMode } from '../utils/searchMatcher';

interface ColumnSummary {
  col: string;
  sum: number;
  count: number;
  formatted: string;
  isAmount: boolean;
}

interface ResultsTableProps {
  columns: string[];
  allRows?: Record<string, any>[];
  results: MatchResult[];
  selectedColumn: string;
  activeMode: SearchMode;
  textOption?: TextMatchOption;
  searchQuery: string;
  onSelectRow: (row: Record<string, any>) => void;
  fileName: string;
  activeSheetName: string;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({
  columns,
  allRows = [],
  results,
  selectedColumn,
  activeMode,
  textOption = 'contain',
  searchQuery,
  onSelectRow,
  fileName,
  activeSheetName,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [includeMatchAudit, setIncludeMatchAudit] = useState(false);
  const [includeRowNumber, setIncludeRowNumber] = useState(false);
  const [includeTotalRow, setIncludeTotalRow] = useState(true);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  // Close export menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    if (showExportMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showExportMenu]);

  // Reset page and scroll to top whenever search query, active column, or active sheet changes
  useEffect(() => {
    setCurrentPage(1);
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollTop = 0;
    }
  }, [searchQuery, selectedColumn, activeSheetName]);

  // Scroll to top on page change
  useEffect(() => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollTop = 0;
    }
  }, [currentPage]);

  // Forward mouse wheel events from anywhere on the screen (margins, headers, toolbars) to the table data scroller
  useEffect(() => {
    const handleGlobalWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Allow default behavior for scrollable modal or form inputs
      if (
        target.closest('input') ||
        target.closest('select') ||
        target.closest('textarea') ||
        target.closest('#detail-modal-card') ||
        target.closest('#table-scroll-container')
      ) {
        return;
      }

      if (tableScrollRef.current) {
        tableScrollRef.current.scrollTop += e.deltaY;
      }
    };

    window.addEventListener('wheel', handleGlobalWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleGlobalWheel);
  }, []);

  const isAllSheets = activeSheetName === ALL_SHEETS_TAB_ID;
  const displayColumns = columns.filter((c) => c !== ALL_COLUMNS_KEY && !c.startsWith('_'));
  const totalAllRowsCount = allRows && allRows.length > 0 ? allRows.length : results.length;

  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  // Guarantee validPage is always within bounds [1, totalPages]
  const validPage = Math.min(Math.max(1, currentPage), totalPages);
  const startRowIndex = results.length === 0 ? 0 : (validPage - 1) * pageSize + 1;
  const endRowIndex = Math.min(validPage * pageSize, results.length);
  const paginatedResults = results.slice((validPage - 1) * pageSize, validPage * pageSize);

  // Generate numbered page buttons with ellipses
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [];
    pages.push(1);

    if (validPage > 3) {
      pages.push('...');
    }

    const start = Math.max(2, validPage - 1);
    const end = Math.min(totalPages - 1, validPage + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (validPage < totalPages - 2) {
      pages.push('...');
    }

    pages.push(totalPages);
    return pages;
  };
  const pageNumbers = getPageNumbers();

  // Identify columns that represent financial amounts, fees, balances or monetary values
  const isAmountColumn = (colName: string): boolean => {
    if (!colName) return false;
    const lower = colName.toLowerCase().trim();

    // 0. Definite CURRENCY CODE exclusion:
    // Columns containing '_cur', 'cur_', currency codes/names (e.g. OPER_AMOUNT_CUR, STTL_AMOUNT_CUR, CURRENCY)
    // are currency identifiers (e.g. 104 = MMK, 840 = USD) and must NEVER be totaled.
    if (
      lower.includes('_cur') ||
      lower.includes('cur_') ||
      lower.endsWith('_cur') ||
      lower.endsWith('-cur') ||
      lower.endsWith('.cur') ||
      lower.includes('_curr') ||
      lower.includes('curr_') ||
      lower.includes('currency') ||
      lower.includes('_ccy') ||
      lower.includes('ccy_') ||
      lower === 'cur' ||
      lower === 'curr' ||
      lower === 'ccy' ||
      /\bcur\b/i.test(colName) ||
      /\bcurr\b/i.test(colName) ||
      /\bccy\b/i.test(colName) ||
      /\bcurrency\b/i.test(colName)
    ) {
      return false;
    }

    // 1. Definite NON-amount column patterns:
    // Dates, Times, Timestamps
    if (
      lower.includes('date') ||
      lower.includes('time') ||
      lower.includes('timestamp') ||
      lower.includes('year') ||
      lower.includes('month') ||
      lower.includes('day')
    ) {
      return false;
    }

    // Identifiers, References, Codes, Party, Names, Types, Statuses, Accounts, Phones, NRC
    if (
      lower.includes('id') ||
      lower.includes('ref') ||
      lower.includes('party') ||
      lower.includes('account') ||
      lower.includes('phone') ||
      lower.includes('mobile') ||
      lower.includes('tel') ||
      lower.includes('nrc') ||
      lower.includes('card') ||
      lower.includes('pan') ||
      lower.includes('terminal') ||
      lower.includes('auth') ||
      lower.includes('trace') ||
      lower.includes('rrn') ||
      lower.includes('stan') ||
      lower.includes('seq') ||
      lower.includes('code') ||
      lower.includes('token') ||
      lower.includes('batch') ||
      lower.includes('type') ||
      lower.includes('mode') ||
      lower.includes('status') ||
      lower.includes('channel') ||
      lower.includes('name') ||
      lower.includes('merchant') ||
      lower.includes('customer') ||
      lower.includes('user') ||
      lower.includes('agent') ||
      lower.includes('branch') ||
      lower.includes('desc') ||
      lower.includes('description') ||
      lower.includes('remark') ||
      lower.includes('note')
    ) {
      // Allow ONLY if the column name EXPLICITLY specifies an amount keyword
      // (e.g. 'receiver amount', 'transaction amount', 'dps fee')
      if (
        lower.includes('amount') ||
        lower.includes('amt') ||
        lower.includes('fee') ||
        lower.includes('expense') ||
        lower.endsWith('_val')
      ) {
        return true;
      }
      return false;
    }

    // 2. Definite AMOUNT keywords
    if (
      lower.includes('amount') ||
      lower.includes('amt') ||
      lower.includes('fee') ||
      lower.includes('fees') ||
      lower.includes('expense') ||
      lower.includes('expenses') ||
      lower.includes('mdr') ||
      lower.includes('price') ||
      lower.includes('cost') ||
      lower.includes('charge') ||
      lower.includes('balance') ||
      lower.includes('salary') ||
      lower.includes('commission') ||
      lower.includes('bonus') ||
      lower.includes('refund') ||
      lower.startsWith('add_ampr') ||
      lower.includes('ampr') ||
      lower.endsWith('_val') ||
      lower.includes('ပမာဏ') ||
      lower.includes('ငွေပမာဏ') ||
      lower.includes('ကျသင့်ငွေ') ||
      lower.includes('တန်ဖိုး') ||
      lower.includes('ကြေး')
    ) {
      return true;
    }

    // Check if column is strictly 'total' or 'sum' or 'net' or 'gross'
    if (lower === 'total' || lower === 'sum' || lower === 'net' || lower === 'gross') {
      return true;
    }

    return false;
  };

  // Calculate sum and count STRICTLY for amount columns across all matched results
  const columnTotals = useMemo(() => {
    const totals: Record<string, ColumnSummary> = {};

    if (results.length === 0) return totals;

    for (const col of displayColumns) {
      // STRICT: Only sum columns that are confirmed genuine Amount / Financial columns
      if (!isAmountColumn(col)) {
        continue;
      }

      let sum = 0;
      let numericCount = 0;
      let hasDecimals = false;

      for (const item of results) {
        const val = item.row[col];
        if (val === null || val === undefined || String(val).trim() === '') {
          continue;
        }

        const num = parseAmount(val);
        if (num !== null && !isNaN(num)) {
          sum += num;
          numericCount++;
          if (!Number.isInteger(num)) {
            hasDecimals = true;
          }
        }
      }

      // Only record total if at least one valid numeric value was found
      if (numericCount > 0) {
        const cleanSum = Math.round((sum + Number.EPSILON) * 1000) / 1000;
        const formatted =
          hasDecimals || !Number.isInteger(cleanSum)
            ? cleanSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : cleanSum.toLocaleString('en-US');

        totals[col] = {
          col,
          sum: cleanSum,
          count: numericCount,
          formatted,
          isAmount: true,
        };
      }
    }

    return totals;
  }, [results, displayColumns]);

  // List of primary amount columns for the bottom summary cards
  const amountSummaryList = useMemo(() => {
    return (Object.values(columnTotals) as ColumnSummary[]).filter((ct) => ct.isAmount);
  }, [columnTotals]);

  const exportData = (format: 'xlsx' | 'csv', scope: 'filtered' | 'all') => {
    try {
      setShowExportMenu(false);
      const isScopeAll = scope === 'all' && allRows && allRows.length > 0;
      const rowsSource = isScopeAll
        ? allRows.map((r, idx) => {
            const cleanRow: Record<string, any> = {};
            for (const [key, val] of Object.entries(r)) {
              if (!key.startsWith('_')) {
                cleanRow[key] = val;
              }
            }
            return {
              ...(includeRowNumber ? { 'No': idx + 1 } : {}),
              ...(isAllSheets ? { 'Worksheet_Source': r._sheetName || 'Sheet' } : {}),
              ...cleanRow,
            };
          })
        : results.map((item, idx) => {
            const cleanRow: Record<string, any> = {};
            for (const [key, val] of Object.entries(item.row)) {
              if (!key.startsWith('_')) {
                cleanRow[key] = val;
              }
            }
            return {
              ...(includeRowNumber ? { 'No': idx + 1 } : {}),
              ...(isAllSheets ? { 'Worksheet_Source': item.row._sheetName || item.sheetName || 'Sheet' } : {}),
              ...cleanRow,
              ...(includeMatchAudit
                ? {
                    'Match_Verification': item.matchReason || 'Matched',
                    'Match_Score_Percent': item.score,
                  }
                : {}),
            };
          });

      if (rowsSource.length === 0) return;

      // Append Total Row if enabled
      if (includeTotalRow && !isScopeAll && rowsSource.length > 0) {
        const totalRow: Record<string, any> = {};
        if (includeRowNumber) {
          totalRow['No'] = 'TOTAL';
        }
        if (isAllSheets) {
          totalRow['Worksheet_Source'] = 'ALL';
        }
        displayColumns.forEach((col) => {
          if (columnTotals[col]) {
            totalRow[col] = columnTotals[col].sum;
          } else {
            totalRow[col] = '';
          }
        });
        if (includeMatchAudit) {
          totalRow['Match_Verification'] = `Total (${results.length} rows)`;
          totalRow['Match_Score_Percent'] = '';
        }
        rowsSource.push(totalRow);
      }

      const worksheet = XLSX.utils.json_to_sheet(rowsSource);
      const workbook = XLSX.utils.book_new();
      const sheetTitle = (isAllSheets ? 'All_Sheets' : activeSheetName).slice(0, 31);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetTitle);

      const cleanFileName = fileName.replace(/\.[^/.]+$/, '');
      const suffix = isScopeAll ? 'All_Records' : 'Filtered_Results';

      if (format === 'xlsx') {
        XLSX.writeFile(workbook, `${cleanFileName}_${sheetTitle}_${suffix}.xlsx`);
      } else {
        XLSX.writeFile(workbook, `${cleanFileName}_${sheetTitle}_${suffix}.csv`, { bookType: 'csv' });
      }
    } catch (err) {
      console.error('Export failed', err);
    }
  };

  const exportToExcel = () => exportData('xlsx', 'filtered');

  // Cell highlight renderer
  const renderCellContent = (col: string, val: any, item: MatchResult) => {
    const textVal = val !== null && val !== undefined ? String(val) : '';
    const isTargetCol =
      col === selectedColumn ||
      (selectedColumn === ALL_COLUMNS_KEY && col === item.matchedColumn);

    if (!isTargetCol || !searchQuery) {
      return <span>{textVal}</span>;
    }

    const highlightTarget = item.highlightText || searchQuery.trim();
    if (highlightTarget) {
      try {
        const escaped = highlightTarget.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`(${escaped})`, 'gi');
        if (regex.test(textVal)) {
          const parts = textVal.split(regex);
          return (
            <span>
              {parts.map((part, index) =>
                part.toLowerCase() === highlightTarget.toLowerCase() ? (
                  <mark key={index} className="bg-amber-200 text-amber-900 font-semibold px-0.5 rounded-xs">
                    {part}
                  </mark>
                ) : (
                  <span key={index}>{part}</span>
                )
              )}
            </span>
          );
        }
      } catch {
        // Fallback to plain text if regex fails
      }
    }

    if (activeMode === 'amount') {
      return (
        <span className="font-mono font-semibold text-blue-800 bg-blue-50/80 px-1.5 py-0.5 rounded border border-blue-200">
          {textVal}
        </span>
      );
    }

    if (activeMode === 'nrc' || activeMode === 'phone') {
      return (
        <span className="font-mono font-medium text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
          {textVal}
        </span>
      );
    }

    return <span>{textVal}</span>;
  };

  return (
    <div
      id="results-table-container"
      className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden flex flex-col"
    >
      {/* Table Header Bar with Actions & Quick Page Navigation - Compact */}
      <div className="py-1 px-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-1.5 bg-slate-50/90 shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1">
            {isAllSheets && <Layers className="w-3.5 h-3.5 text-indigo-600" />}
            {isAllSheets ? 'All Sheets Results' : 'Search Results'}
          </h4>
          <span className={`px-1.5 py-0.2 rounded-full text-[11px] font-semibold ${
            isAllSheets ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'
          }`}>
            {results.length.toLocaleString()} {results.length === 1 ? 'row' : 'rows'}
          </span>
        </div>

        {/* Top Header Quick Controls */}
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {results.length > 0 && (
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-md px-1.5 py-0.5 shadow-2xs text-[11px] text-slate-600">
              <button
                type="button"
                onClick={() => setCurrentPage(Math.max(1, validPage - 1))}
                disabled={validPage <= 1}
                className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Previous Page"
              >
                <ChevronLeft className="w-3 h-3 text-slate-600" />
              </button>
              <span className="font-semibold text-slate-800 px-0.5">
                {validPage}/{totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(Math.min(totalPages, validPage + 1))}
                disabled={validPage >= totalPages}
                className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Next Page"
              >
                <ChevronRight className="w-3 h-3 text-slate-600" />
              </button>

              <div className="h-2.5 w-px bg-slate-200 mx-0.5" />

              <span className="text-[10px] text-slate-400 font-medium">Rows:</span>
              <select
                id="select-top-page-size"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-transparent border-none text-[11px] font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
              </select>
            </div>
          )}

          {/* Export Button & Menu */}
          <div className="relative inline-flex items-center rounded-md shadow-2xs" ref={exportMenuRef}>
            <button
              id="btn-export-excel"
              type="button"
              onClick={exportToExcel}
              disabled={results.length === 0}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded-l-md transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Export filtered records to Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>
            <button
              id="btn-export-dropdown-toggle"
              type="button"
              onClick={() => setShowExportMenu((prev) => !prev)}
              disabled={results.length === 0}
              className="px-1.5 py-1 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs rounded-r-md border-l border-emerald-800/40 transition-colors flex items-center cursor-pointer"
              title="More export options (CSV, All rows)"
            >
              <ChevronDown className="w-3 h-3" />
            </button>

            {showExportMenu && (
              <div
                id="export-options-dropdown"
                className="absolute right-0 top-full mt-1 w-64 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 z-50 text-xs"
              >
                <div className="px-3 py-1 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-100 flex items-center justify-between">
                  <span>Export Options</span>
                  <span className="text-[9px] font-mono text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded">
                    {displayColumns.length} Cols
                  </span>
                </div>

                {/* Column format preferences */}
                <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 space-y-1">
                  <div className="text-[10px] font-semibold text-slate-500">
                    Columns to Include:
                  </div>
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-slate-900 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeMatchAudit}
                      onChange={(e) => setIncludeMatchAudit(e.target.checked)}
                      className="rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 w-3 h-3"
                    />
                    <span>Include Match Verification & Score</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-slate-900 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeRowNumber}
                      onChange={(e) => setIncludeRowNumber(e.target.checked)}
                      className="rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 w-3 h-3"
                    />
                    <span>Include "No" Index Column</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-slate-900 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeTotalRow}
                      onChange={(e) => setIncludeTotalRow(e.target.checked)}
                      className="rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 w-3 h-3"
                    />
                    <span>Include Totals Row at bottom (စုစုပေါင်း)</span>
                  </label>
                  <div className="text-[9px] text-slate-400 pt-0.5">
                    {!includeMatchAudit && !includeRowNumber && !includeTotalRow
                      ? `✓ Clean export (${displayColumns.length} original columns only)`
                      : `+ Added metadata & total rows`}
                  </div>
                </div>

                {/* Excel Section */}
                <button
                  type="button"
                  onClick={() => exportData('xlsx', 'filtered')}
                  className="w-full text-left px-3 py-1.5 hover:bg-emerald-50 text-slate-700 flex items-center justify-between gap-2 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Excel (.xlsx) - Filtered</span>
                  </span>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                    {results.length}
                  </span>
                </button>

                {allRows && allRows.length > results.length && (
                  <button
                    type="button"
                    onClick={() => exportData('xlsx', 'all')}
                    className="w-full text-left px-3 py-1.5 hover:bg-emerald-50 text-slate-700 flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Excel (.xlsx) - All Rows</span>
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                      {totalAllRowsCount}
                    </span>
                  </button>
                )}

                <div className="my-1 border-t border-slate-100" />

                {/* CSV Section */}
                <button
                  type="button"
                  onClick={() => exportData('csv', 'filtered')}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center justify-between gap-2 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-600" />
                    <span>CSV (.csv) - Filtered</span>
                  </span>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                    {results.length}
                  </span>
                </button>

                {allRows && allRows.length > results.length && (
                  <button
                    type="button"
                    onClick={() => exportData('csv', 'all')}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-slate-600" />
                      <span>CSV (.csv) - All Rows</span>
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                      {totalAllRowsCount}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table Content with Sticky / Frozen Header */}
      <div
        id="table-scroll-container"
        ref={tableScrollRef}
        tabIndex={0}
        className="overflow-auto max-h-[calc(100vh-220px)] min-h-[220px] relative border-b border-slate-200 focus:outline-none"
      >
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 z-20 shadow-xs">
            <tr className="border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px] leading-tight">
              <th className="sticky top-0 left-0 z-30 py-1.5 px-2 w-10 text-center bg-slate-100 border-r border-slate-200">#</th>
              {isAllSheets && (
                <th className="sticky top-0 py-1.5 px-2 text-left bg-indigo-100 text-indigo-900 border-r border-indigo-200 whitespace-nowrap">
                  Sheet
                </th>
              )}
              <th className="sticky top-0 py-1.5 px-2 w-44 text-left bg-emerald-100 border-l border-r border-emerald-200 text-emerald-900">
                Match Verification
              </th>
              {displayColumns.map((col) => {
                const isSelected =
                  col === selectedColumn ||
                  (selectedColumn === ALL_COLUMNS_KEY && results.some((r) => r.matchedColumn === col));

                return (
                  <th
                    key={col}
                    className={`sticky top-0 py-1.5 px-2 whitespace-nowrap border-b border-slate-200 ${
                      isSelected
                        ? 'bg-amber-100 text-amber-900 font-bold border-b-2 border-amber-500'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span>{col}</span>
                      {col === selectedColumn && (
                        <span className="text-[9px] px-1 py-0 rounded bg-amber-200 text-amber-900 font-normal">
                          Active
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
              <th className="sticky top-0 py-1.5 px-1.5 text-center w-10 bg-slate-100 border-b border-slate-200">View</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedResults.length > 0 ? (
              paginatedResults.map((item, index) => {
                const rowNum = (validPage - 1) * pageSize + index + 1;
                const rowSheet = item.row._sheetName || item.sheetName;

                return (
                  <tr
                    key={index}
                    className="hover:bg-slate-50/90 transition-colors group cursor-pointer"
                    onClick={() => onSelectRow(item.row)}
                  >
                    <td className="sticky left-0 z-10 py-1 px-2 text-center text-slate-400 font-mono text-[11px] bg-white group-hover:bg-slate-50 border-r border-slate-100">
                      {rowNum}
                    </td>

                    {/* Sheet Badge if All Sheets */}
                    {isAllSheets && (
                      <td className="py-1 px-2 whitespace-nowrap border-r border-slate-100">
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {rowSheet || 'Sheet'}
                        </span>
                      </td>
                    )}

                    {/* Match reason badge */}
                    <td className="py-1 px-2 border-l border-r border-slate-100 bg-slate-50/40">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span className="truncate max-w-[170px]" title={item.matchReason}>
                            {item.matchReason}
                          </span>
                        </div>
                        {item.score < 100 && (
                          <div className="w-full bg-slate-200 rounded-full h-1 mt-0.5 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-1 rounded-full"
                              style={{ width: `${item.score}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Columns */}
                    {displayColumns.map((col) => {
                      const isSelected =
                        col === selectedColumn ||
                        (selectedColumn === ALL_COLUMNS_KEY && item.matchedColumn === col);
                      const cellVal = item.row[col];
                      return (
                        <td
                          key={col}
                          className={`py-1 px-2 whitespace-nowrap text-slate-700 text-xs max-w-xs truncate ${
                            isSelected ? 'bg-amber-50/30 font-medium' : ''
                          }`}
                          title={String(cellVal ?? '')}
                        >
                          {renderCellContent(col, cellVal, item)}
                        </td>
                      );
                    })}

                    {/* View Detail Action */}
                    <td className="py-0.5 px-1 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectRow(item.row);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                        title="View Full Record"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={displayColumns.length + (isAllSheets ? 4 : 3)} className="py-8 text-center text-slate-500">
                  <div className="sticky left-0 right-0 max-w-md mx-auto px-4">
                    <p className="text-xs font-semibold text-slate-700 mb-0.5">
                      No matching records found
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {activeMode === 'amount'
                        ? 'No amounts match condition (e.g. try > 10000, < 50000, = 300000 or 300000)'
                        : activeMode === 'nrc'
                        ? 'Ensure NRC last 6 digits match or try Myanmar/English digits'
                        : activeMode === 'phone'
                        ? 'Ensure at least the last 6 digits of phone match'
                        : 'Try searching with an alternative spelling or partial term'}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>

          {/* Sticky Table Footer: Sum of Result Rows per column */}
          {results.length > 0 && (
            <tfoot className="sticky bottom-0 z-20 shadow-xs border-t-2 border-slate-300 bg-slate-100 text-slate-800">
              <tr className="font-semibold text-xs leading-tight divide-x divide-slate-200">
                {/* Row index column sum icon */}
                <td className="sticky left-0 z-30 py-2 px-2 text-center bg-slate-200 border-r border-slate-300 font-bold text-[12px] text-slate-800 shadow-2xs">
                  Σ
                </td>

                {/* All Sheets indicator */}
                {isAllSheets && (
                  <td className="py-2 px-2 border-r border-slate-300 text-indigo-900 bg-indigo-50/90 font-bold text-[10px] uppercase">
                    All
                  </td>
                )}

                {/* Match Verification summary cell */}
                <td className="py-2 px-2 border-l border-r border-slate-300 bg-emerald-100/80 text-emerald-950 font-bold text-xs">
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="text-slate-700 font-medium">Total:</span>
                    <span className="font-mono bg-white text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded text-[11px] font-bold shadow-2xs">
                      {results.length.toLocaleString()} rows
                    </span>
                  </div>
                </td>

                {/* Columns sum cells */}
                {displayColumns.map((col) => {
                  const colTotal = columnTotals[col];
                  const isSelected =
                    col === selectedColumn ||
                    (selectedColumn === ALL_COLUMNS_KEY && results.some((r) => r.matchedColumn === col));

                  return (
                    <td
                      key={`tfoot-col-${col}`}
                      className={`py-2 px-2 whitespace-nowrap font-mono text-xs ${
                        colTotal
                          ? isSelected
                            ? 'bg-amber-100 text-amber-950 font-bold border-t-2 border-t-amber-500'
                            : 'bg-emerald-50/80 text-emerald-950 font-bold'
                          : 'text-slate-300 text-center font-normal select-none'
                      }`}
                      title={
                        colTotal
                          ? `${col} Total Sum: ${colTotal.formatted} (${colTotal.count.toLocaleString()} rows)`
                          : undefined
                      }
                    >
                      {colTotal ? (
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-950 text-xs tracking-tight">
                            {colTotal.formatted}
                          </span>
                          <span className="text-[9px] text-slate-500 font-sans font-normal">
                            ({colTotal.count.toLocaleString()} rows)
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-300 select-none">—</span>
                      )}
                    </td>
                  );
                })}

                {/* Action View Column */}
                <td className="py-2 px-1 text-center bg-slate-100 text-slate-300 select-none">—</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Result Row Amount Summary Bar (ရလဒ် Amount စုစုပေါင်း) */}
      {results.length > 0 && amountSummaryList.length > 0 && (
        <div
          id="results-amount-summary-bar"
          className="bg-emerald-50/90 border-t border-b border-emerald-200 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0 select-none"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-emerald-950 font-bold">
              <Calculator className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>Result Amounts Total (ရလဒ် စုစုပေါင်း ပမာဏ):</span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {amountSummaryList.map((item) => {
                const isSelected = item.col === selectedColumn;
                return (
                  <div
                    key={`summary-card-${item.col}`}
                    className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-xs shadow-2xs transition-all ${
                      isSelected
                        ? 'bg-amber-100 border-amber-300 text-amber-950 font-bold ring-1 ring-amber-400'
                        : 'bg-white border-emerald-200 text-slate-800 hover:border-emerald-300'
                    }`}
                    title={`${item.col}: ${item.formatted} (Sum of ${item.count} items)`}
                  >
                    <span className="text-slate-600 text-[11px] font-medium">{item.col}:</span>
                    <span className="font-mono font-bold text-emerald-700 text-xs">{item.formatted}</span>
                    <span className="text-[10px] text-slate-400 font-sans">({item.count} rows)</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium ml-auto">
            <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold border border-emerald-200">
              Σ {amountSummaryList.length} {amountSummaryList.length === 1 ? 'Column' : 'Columns'}
            </span>
            <span>
              from all <strong className="text-slate-900">{results.length.toLocaleString()}</strong> matched rows
            </span>
          </div>
        </div>
      )}

      {/* Bottom Pagination & Selection Bar - Compact */}
      {results.length > 0 && (
        <div
          id="table-pagination-bar"
          className="py-1 px-2.5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-1.5 text-xs text-slate-600 shrink-0"
        >
          {/* Left: Range and total count info */}
          <div className="flex items-center gap-1.5 flex-wrap text-center sm:text-left text-[11px]">
            <span className="text-slate-600">
              Showing <strong className="text-slate-900 font-semibold">{startRowIndex.toLocaleString()}</strong>-
              <strong className="text-slate-900 font-semibold">{endRowIndex.toLocaleString()}</strong> of{' '}
              <strong className="text-slate-900 font-semibold">{results.length.toLocaleString()}</strong>
            </span>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <span className="text-slate-500">
              Page <strong className="text-slate-800">{validPage}</strong>/{totalPages}
            </span>
          </div>

          {/* Center / Right: Page Size selector and Page navigation buttons */}
          <div className="flex items-center gap-1.5 flex-wrap justify-center sm:justify-end">
            <div className="flex items-center gap-1 text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded-md shadow-2xs text-[11px]">
              <span className="text-slate-500 font-medium">Rows:</span>
              <select
                id="select-bottom-page-size"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-transparent border-none text-[11px] font-semibold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
              </select>
            </div>

            {/* Pagination Button Group */}
            <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-md p-0.5 shadow-2xs">
              <button
                id="btn-first-page"
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={validPage <= 1}
                className="p-0.5 rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="First Page"
              >
                <ChevronsLeft className="w-3 h-3" />
              </button>
              <button
                id="btn-prev-page"
                type="button"
                onClick={() => setCurrentPage(Math.max(1, validPage - 1))}
                disabled={validPage <= 1}
                className="p-0.5 rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Previous Page"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>

              {/* Page Number Chips */}
              <div className="flex items-center gap-0.5 px-0.5">
                {pageNumbers.map((p, idx) =>
                  p === '...' ? (
                    <span key={`dots-${idx}`} className="px-0.5 text-slate-400 select-none text-[10px]">
                      ...
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCurrentPage(Number(p))}
                      className={`min-w-[22px] h-5 px-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                        p === validPage
                          ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
              </div>

              <button
                id="btn-next-page"
                type="button"
                onClick={() => setCurrentPage(Math.min(totalPages, validPage + 1))}
                disabled={validPage >= totalPages}
                className="p-0.5 rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Next Page"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
              <button
                id="btn-last-page"
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={validPage >= totalPages}
                className="p-0.5 rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Last Page"
              >
                <ChevronsRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

