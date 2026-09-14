import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { MatchResult, SearchMode, ALL_SHEETS_TAB_ID, ALL_COLUMNS_KEY } from '../types';
import { Download, Eye, ChevronLeft, ChevronRight, CheckCircle2, Layers } from 'lucide-react';

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
  const pageSize = 15;

  // Reset page to 1 whenever search query, active column, or active sheet changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedColumn, activeSheetName]);

  const isAllSheets = activeSheetName === ALL_SHEETS_TAB_ID;
  const displayColumns = columns.filter((c) => c !== ALL_COLUMNS_KEY && !c.startsWith('_'));

  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  // Guarantee validPage is always within bounds [1, totalPages]
  const validPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedResults = results.slice((validPage - 1) * pageSize, validPage * pageSize);

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
    <div id="results-table-container" className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col">
      {/* Table Header Bar with Actions */}
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/70">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
            {isAllSheets && <Layers className="w-4 h-4 text-indigo-600" />}
            {isAllSheets ? 'All Sheets Search Results' : 'Search Results'}
          </h4>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            isAllSheets ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'
          }`}>
            {results.length.toLocaleString()} {results.length === 1 ? 'row' : 'rows'}
          </span>
          {searchQuery && (
            <span className="text-xs text-slate-500 hidden md:inline">
              (Query: <strong className="text-slate-700">"{searchQuery}"</strong> in{' '}
              <strong className="text-slate-700">
                {isAllSheets ? 'All Sheets (Combined)' : `sheet "${activeSheetName}"`}
              </strong>)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            id="btn-export-excel"
            type="button"
            onClick={exportToExcel}
            disabled={results.length === 0}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export to Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-3 w-12 text-center">#</th>
              {isAllSheets && (
                <th className="py-3 px-3.5 text-left bg-indigo-50/70 text-indigo-900 border-r border-indigo-100 whitespace-nowrap">
                  Sheet
                </th>
              )}
              <th className="py-3 px-3 w-52 text-left bg-emerald-50/60 border-l border-r border-emerald-100 text-emerald-900">
                Match Verification
              </th>
              {displayColumns.map((col) => {
                const isSelected =
                  col === selectedColumn ||
                  (selectedColumn === ALL_COLUMNS_KEY && results.some((r) => r.matchedColumn === col));

                return (
                  <th
                    key={col}
                    className={`py-3 px-3.5 whitespace-nowrap ${
                      col === selectedColumn
                        ? 'bg-amber-50 text-amber-900 font-bold border-b-2 border-amber-500'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col}</span>
                      {col === selectedColumn && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 font-normal">
                          Active Column
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
              <th className="py-3 px-3 text-center w-16">Details</th>
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
                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                      {rowNum}
                    </td>

                    {/* Sheet Badge if All Sheets */}
                    {isAllSheets && (
                      <td className="py-2.5 px-3.5 whitespace-nowrap border-r border-slate-100">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {rowSheet || 'Sheet'}
                        </span>
                      </td>
                    )}

                    {/* Match reason badge */}
                    <td className="py-2.5 px-3 border-l border-r border-slate-100 bg-slate-50/40">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate max-w-[200px]" title={item.matchReason}>
                            {item.matchReason}
                          </span>
                        </div>
                        {item.score < 100 && (
                          <div className="w-full bg-slate-200 rounded-full h-1.5 mt-0.5 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-1.5 rounded-full"
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
                          className={`py-2.5 px-3.5 whitespace-nowrap text-slate-700 max-w-xs truncate ${
                            isSelected ? 'bg-amber-50/30 font-medium' : ''
                          }`}
                          title={String(cellVal ?? '')}
                        >
                          {renderCellContent(col, cellVal, item)}
                        </td>
                      );
                    })}

                    {/* View Detail Action */}
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectRow(item.row);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                        title="View Full Record Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={displayColumns.length + (isAllSheets ? 4 : 3)} className="py-12 text-center text-slate-500">
                  <div className="sticky left-0 right-0 max-w-md mx-auto px-4">
                    <p className="text-sm font-semibold text-slate-700 mb-1">
                      No matching records found
                    </p>
                    <p className="text-xs text-slate-400">
                      {activeMode === 'nrc'
                        ? 'Ensure NRC last 6 digits match or try entering Myanmar/English digits (e.g. 054079)'
                        : activeMode === 'phone'
                        ? 'Ensure at least the last 6 digits of the phone number match'
                        : 'Try searching with an alternative spelling or partial term'}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
          <div>
            Page <span className="font-semibold text-slate-800">{validPage}</span> of{' '}
            <span className="font-semibold text-slate-800">{totalPages}</span> (Total{' '}
            {results.length.toLocaleString()} records)
          </div>
          <div className="flex items-center gap-1">
            <button
              id="btn-prev-page"
              type="button"
              onClick={() => setCurrentPage(Math.max(1, validPage - 1))}
              disabled={validPage <= 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-medium">{validPage}</span>
            <button
              id="btn-next-page"
              type="button"
              onClick={() => setCurrentPage(Math.min(totalPages, validPage + 1))}
              disabled={validPage >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

