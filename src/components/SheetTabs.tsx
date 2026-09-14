import React, { useRef } from 'react';
import { SheetDetail, ALL_SHEETS_TAB_ID } from '../types';
import { Table, ChevronLeft, ChevronRight, Layers } from 'lucide-react';

interface SheetTabsProps {
  sheetNames: string[];
  activeSheetName: string;
  sheets: Record<string, SheetDetail>;
  onSelectSheet: (sheetName: string) => void;
}

export const SheetTabs: React.FC<SheetTabsProps> = ({
  sheetNames,
  activeSheetName,
  sheets,
  onSelectSheet,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const totalAllRows = sheetNames.reduce((sum, name) => sum + (sheets[name]?.rows?.length || 0), 0);
  const isAllSheetsActive = activeSheetName === ALL_SHEETS_TAB_ID;

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div id="sheet-tabs-bar" className="w-full bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Excel Sheets / Tabs
          </span>
          <span className="px-2 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[11px] font-semibold">
            {sheetNames.length} {sheetNames.length === 1 ? 'Sheet' : 'Sheets'} • {totalAllRows.toLocaleString()} Total Records
          </span>
        </div>

        {sheetNames.length > 2 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => scroll('left')}
              className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors"
              title="Scroll Tabs Left"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => scroll('right')}
              className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors"
              title="Scroll Tabs Right"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Tabs list */}
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-1.5 p-2 overflow-x-auto no-scrollbar bg-slate-100/50"
      >
        {/* All Sheets Tab */}
        <button
          id="sheet-tab-all-sheets"
          type="button"
          onClick={() => onSelectSheet(ALL_SHEETS_TAB_ID)}
          className={`group flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${
            isAllSheetsActive
              ? 'bg-indigo-50 text-indigo-900 shadow-xs border border-indigo-300 font-bold ring-1 ring-indigo-500/30'
              : 'bg-white/80 text-slate-700 hover:bg-white hover:text-slate-900 border border-slate-200/80 shadow-2xs'
          }`}
          title={`Search across all ${sheetNames.length} sheets (${totalAllRows} rows total)`}
        >
          <Layers className={`w-3.5 h-3.5 ${isAllSheetsActive ? 'text-indigo-600' : 'text-slate-500 group-hover:text-indigo-600'}`} />
          <span className="font-semibold">All Sheets (Combined)</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              isAllSheetsActive
                ? 'bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold'
                : 'bg-slate-200 text-slate-700 font-medium'
            }`}
          >
            {totalAllRows.toLocaleString()} rows
          </span>
        </button>

        {/* Visual Separator */}
        <div className="h-5 w-px bg-slate-300 mx-1 shrink-0" />

        {/* Individual Sheets Tabs */}
        {sheetNames.map((name) => {
          const isActive = name === activeSheetName;
          const sheet = sheets[name];
          const rowCount = sheet ? sheet.rows.length : 0;
          const colCount = sheet ? sheet.columns.length : 0;

          return (
            <button
              key={name}
              id={`sheet-tab-${name}`}
              type="button"
              onClick={() => onSelectSheet(name)}
              className={`group flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-white text-emerald-800 shadow-xs border border-slate-200 font-semibold ring-1 ring-emerald-500/20'
                  : 'bg-transparent text-slate-600 hover:bg-white/70 hover:text-slate-900 border border-transparent'
              }`}
            >
              <Table className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
              <span className="truncate max-w-[200px]">{name}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-200 text-slate-600'
                }`}
                title={`${rowCount} rows, ${colCount} columns`}
              >
                {rowCount.toLocaleString()} rows
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

