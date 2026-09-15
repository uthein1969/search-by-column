import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { MatchResult, SearchMode, ALL_SHEETS_TAB_ID, ALL_COLUMNS_KEY } from '../types';
import { Download, Eye, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CheckCircle2, Layers } from 'lucide-react';

interface ResultsTableProps {
  columns: string[];
  results: MatchResult[];
  selectedColumn: string;
  activeMode: SearchMode;
  searchQuery: string;
  onSelectRow: (row: Record<string, any>) => void;
  fileName: string;
  activeSheetName: string;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({
  columns,
  results,
  selectedColumn,
  activeMode,
  searchQuery,
  onSelectRow,
  fileName,
  activeSheetName,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const tableScrollRef = useRef<HTMLDivElement>(null);

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

  const exportToExcel = () => {
    try {
      const exportRows = results.map((item, idx) => {
        const cleanRow: Record<string, any> = {};
        for (const [key, val] of Object.entries(item.row)) {
          if (!key.startsWith('_')) {
            cleanRow[key] = val;
          }
        }

        return {
          'No': idx + 1,
          ...(isAllSheets ? { 'Worksheet_Source': item.row._sheetName || item.sheetName || 'Sheet' } : {}),
          ...cleanRow,
          'Match_Verification': item.matchReason || 'Matched',
          'Match_Score_Percent': item.score,
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      const sheetTitle = isAllSheets ? 'All_Sheets' : activeSheetName;
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetTitle.slice(0, 31));

      const cleanFileName = fileName.replace(/\.[^/.]+$/, '');
      XLSX.writeFile(workbook, `${cleanFileName}_${sheetTitle}_Filtered_Results.xlsx`);
    } catch (err) {
      console.error('Export failed', err);
    }
  };

  // Cell highlight renderer
  const renderCellContent = (col: string, val: any, item: MatchResult) => {
    const textVal = val !== null && val !== undefined ? String(val) : '';
    const isTargetCol =
      col === selectedColumn ||
      (selectedColumn === ALL_COLUMNS_KEY && col === item.matchedColumn);

    if (!isTargetCol || !searchQuery) {
      return <span>{textVal}</span>;
    }

    if (item.highlightText && textVal.includes(item.highlightText)) {
      const parts = textVal.split(item.highlightText);
      return (
        <span>
          {parts.map((part, index) => (
            <React.Fragment key={index}>
              {part}
              {index < parts.length - 1 && (
                <mark className="bg-amber-200 text-amber-900 font-semibold px-1 rounded-xs">
                  {item.highlightText}
                </mark>
              )}
            </React.Fragment>
          ))}
        </span>
      );
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

          <button
            id="btn-export-excel"
            type="button"
            onClick={exportToExcel}
            disabled={results.length === 0}
            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-medium rounded-md transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
          >
            <Download className="w-3 h-3" />
            <span>Export</span>
          </button>
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
        </table>
      </div>

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

