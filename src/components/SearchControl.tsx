import React, { useState } from 'react';
import { SearchMode, ColumnInfo, ALL_COLUMNS_KEY } from '../types';
import { extractDigits } from '../utils/numberUtils';
import { Search, X, ShieldCheck, PhoneCall, Sparkles, SlidersHorizontal, Info } from 'lucide-react';

interface SearchControlProps {
  columns: string[];
  columnInfos: ColumnInfo[];
  selectedColumn: string;
  onSelectColumn: (column: string) => void;
  activeMode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalRows: number;
  matchedCount: number;
}

export const SearchControl: React.FC<SearchControlProps> = ({
  columns,
  columnInfos,
  selectedColumn,
  onSelectColumn,
  activeMode,
  onModeChange,
  searchQuery,
  onSearchChange,
  totalRows,
  matchedCount,
}) => {
  const [showModeOverride, setShowModeOverride] = useState(false);

  // Check if query contains Myanmar numerals to give helpful English feedback
  const hasMyanmarDigits = /[၀-၉]/.test(searchQuery);
  const convertedDigits = extractDigits(searchQuery);

  const getModeBadge = (mode: SearchMode) => {
    switch (mode) {
      case 'nrc':
        return {
          label: 'NRC (Last 6 Digits)',
          badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          icon: ShieldCheck,
        };
      case 'phone':
        return {
          label: 'Phone (Last 6+ Digits)',
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: PhoneCall,
        };
      default:
        return {
          label: 'Fuzzy Match (Approximate)',
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
          icon: Sparkles,
        };
    }
  };

  const currentBadge = getModeBadge(activeMode);
  const BadgeIcon = currentBadge.icon;

  return (
    <div id="search-control-container" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
        {/* Column Dropdown Selector */}
        <div className="w-full lg:w-72 shrink-0">
          <label htmlFor="column-select-dropdown" className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
            Select Column to Search
          </label>
          <div className="relative">
            <select
              id="column-select-dropdown"
              value={selectedColumn}
              onChange={(e) => onSelectColumn(e.target.value)}
              className="w-full pl-3 pr-8 py-2.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer truncate"
            >
              {columns.map((col) => {
                if (col === ALL_COLUMNS_KEY) {
                  return (
                    <option key={col} value={col}>
                      🔍 All Columns (Search Any Field)
                    </option>
                  );
                }
                const info = columnInfos.find((c) => c.name === col);
                const modeLabel =
                  info?.detectedMode === 'nrc'
                    ? '[NRC: Last 6 Digits]'
                    : info?.detectedMode === 'phone'
                    ? '[Phone: Last 6+ Digits]'
                    : '[Fuzzy Match]';

                return (
                  <option key={col} value={col}>
                    {col} {modeLabel}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Search Query Input */}
        <div className="flex-1">
          <label htmlFor="search-input-field" className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
            Enter Search Term or Digits
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              id="search-input-field"
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={
                selectedColumn === ALL_COLUMNS_KEY
                  ? 'Search anything across all fields (NRC, Phone, Name, Department)...'
                  : activeMode === 'nrc'
                  ? 'Enter NRC last 6 digits (e.g. 104521 or full NRC)...'
                  : activeMode === 'phone'
                  ? 'Enter at least last 6 digits of Phone (e.g. 012345, 450012345)...'
                  : `Search approximate text in "${selectedColumn}"...`
              }
              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            {searchQuery && (
              <button
                id="btn-clear-search"
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title="Clear Search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Rule Indicator & Override Toggle */}
        <div className="flex items-end gap-2 shrink-0">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-slate-500 mb-1.5 hidden lg:block">
              Matching Rule
            </span>
            <div
              id="active-rule-badge"
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border ${currentBadge.badgeClass}`}
            >
              <BadgeIcon className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">{currentBadge.label}</span>
            </div>
          </div>

          <button
            id="btn-toggle-override"
            type="button"
            onClick={() => setShowModeOverride(!showModeOverride)}
            className={`p-2.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
              showModeOverride
                ? 'bg-slate-200 border-slate-300 text-slate-800'
                : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
            }`}
            title="Toggle Rule Override Options"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mode Override Bar */}
      {showModeOverride && (
        <div id="mode-override-bar" className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">Override Rule Mode:</span>
          <button
            id="btn-mode-nrc"
            type="button"
            onClick={() => onModeChange('nrc')}
            className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
              activeMode === 'nrc'
                ? 'bg-indigo-600 text-white border-indigo-600 font-semibold shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            NRC Mode (Last 6 Digits)
          </button>
          <button
            id="btn-mode-phone"
            type="button"
            onClick={() => onModeChange('phone')}
            className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
              activeMode === 'phone'
                ? 'bg-emerald-600 text-white border-emerald-600 font-semibold shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Phone Mode (Last 6+ Digits)
          </button>
          <button
            id="btn-mode-fuzzy"
            type="button"
            onClick={() => onModeChange('fuzzy')}
            className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
              activeMode === 'fuzzy'
                ? 'bg-amber-600 text-white border-amber-600 font-semibold shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Fuzzy Match (Approximate)
          </button>
        </div>
      )}

      {/* Explanatory banner in English */}
      <div id="rule-explanation-box" className="mt-4 p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed">
        <Info className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
        <div className="flex-1">
          {activeMode === 'nrc' && (
            <div>
              <strong className="text-indigo-700 font-semibold">NRC Matching Rule:</strong>{' '}
              Verifies whether the <strong>last 6 digits</strong> of the NRC match. Myanmar numerals (e.g. ၁၂၃၄၅၆) and Western numerals (123456) are automatically normalized.
              {hasMyanmarDigits && (
                <span className="block mt-1 text-emerald-700 font-medium">
                  ✓ Myanmar numerals converted to digits: [{convertedDigits}]
                </span>
              )}
            </div>
          )}

          {activeMode === 'phone' && (
            <div>
              <strong className="text-emerald-700 font-semibold">Phone Matching Rule:</strong>{' '}
              Verifies that <strong>at least the last 6 digits</strong> match the phone number suffix. You can search by last 6, 7, 8, or full phone numbers.
              {convertedDigits.length > 0 && convertedDigits.length < 6 && (
                <span className="block mt-1 text-amber-700 font-medium">
                  Note: The rule requires at least 6 digits for complete verification (Currently: {convertedDigits.length} digits entered).
                </span>
              )}
            </div>
          )}

          {activeMode === 'fuzzy' && (
            <div>
              <strong className="text-amber-700 font-semibold">Approximate (Fuzzy) Matching Rule:</strong>{' '}
              For standard text columns, finds the closest matching entries using string similarity, substrings, and token overlap, sorted by match percentage.
            </div>
          )}
        </div>

        {/* Results Counter */}
        <div className="shrink-0 text-right font-medium">
          <span className="text-slate-400">Found: </span>
          <span className={matchedCount > 0 ? 'text-emerald-600 font-semibold text-sm' : 'text-rose-600 font-semibold text-sm'}>
            {matchedCount.toLocaleString()}
          </span>
          <span className="text-slate-400 text-[11px]"> / {totalRows.toLocaleString()} rows</span>
        </div>
      </div>
    </div>
  );
};
