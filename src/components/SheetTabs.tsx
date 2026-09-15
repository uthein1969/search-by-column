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
    <div id="sheet-tabs-bar" className="w-full bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden px-2 py-0.5 flex items-center justify-between gap-1.5">
      {/* Left side: Sheets icon + scrollable tabs */}
      <div className="flex items-center gap-1 min-w-0 flex-1">
        <Layers className="w-3.5 h-3.5 text-emerald-600 shrink-0" />

        {/* Scrollable Tabs list */}
        <div
          ref={scrollContainerRef}
          className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5"
        >
          {/* All Sheets Tab */}
          <button
            id="sheet-tab-all-sheets"
            type="button"
            onClick={() => onSelectSheet(ALL_SHEETS_TAB_ID)}
            className={`group flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium transition-all shrink-0 cursor-pointer ${
              isAllSheetsActive
                ? 'bg-indigo-600 text-white shadow-xs font-bold'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/60'
            }`}
            title={`Search across all sheets (${totalAllRows.toLocaleString()} rows)`}
          >
            <Layers className={`w-3 h-3 ${isAllSheetsActive ? 'text-white' : 'text-slate-500'}`} />
            <span>All Sheets</span>
            <span
              className={`text-[10px] px-1 py-0.1 rounded font-mono ${
                isAllSheetsActive
                  ? 'bg-indigo-700 text-indigo-100 font-bold'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {totalAllRows.toLocaleString()}
            </span>
          </button>

          {/* Visual Separator */}
          <div className="h-3.5 w-px bg-slate-300 mx-0.5 shrink-0" />

          {/* Individual Sheets Tabs */}
          {sheetNames.map((name) => {
            const isActive = name === activeSheetName;
            const sheet = sheets[name];
            const rowCount = sheet ? sheet.rows.length : 0;

            return (
              <button
                key={name}
                id={`sheet-tab-${name}`}
                type="button"
                onClick={() => onSelectSheet(name)}
                className={`group flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-xs font-bold'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/60'
                }`}
              >
                <Table className={`w-3 h-3 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate max-w-[130px]">{name}</span>
                <span
                  className={`text-[10px] px-1 py-0.1 rounded font-mono ${
                    isActive
                      ? 'bg-emerald-700 text-emerald-100 font-bold'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {rowCount.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right side: Scroll arrows only */}
      {sheetNames.length > 2 && (
        <div className="flex items-center gap-0.5 shrink-0 pl-1 border-l border-slate-200">
          <button
            type="button"
            onClick={() => scroll('left')}
            className="p-0.5 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Scroll Tabs Left"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => scroll('right')}
            className="p-0.5 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Scroll Tabs Right"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

