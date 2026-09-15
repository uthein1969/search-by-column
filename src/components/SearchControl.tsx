import React, { useState } from 'react';
import { SearchMode, ColumnInfo, ALL_COLUMNS_KEY } from '../types';
import { extractDigits, convertMyanmarToEnglishDigits } from '../utils/numberUtils';
import { Search, X, ShieldCheck, PhoneCall, Sparkles, SlidersHorizontal, Calculator } from 'lucide-react';

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
  const convertedQuery = convertMyanmarToEnglishDigits(searchQuery);

  const getModeBadge = (mode: SearchMode) => {
    switch (mode) {
      case 'amount':
        return {
          label: 'Amount (>, <, =)',
          badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: Calculator,
        };
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

  // Detect active operator for Amount mode
  const getActiveOperator = (query: string): string => {
    const trimmed = query.trim();
    if (trimmed.startsWith('>=') || trimmed.startsWith('=>')) return '>=';
    if (trimmed.startsWith('<=') || trimmed.startsWith('=<')) return '<=';
    if (trimmed.startsWith('!=') || trimmed.startsWith('<>')) return '!=';
    if (trimmed.startsWith('>')) return '>';
    if (trimmed.startsWith('<')) return '<';
    if (trimmed.startsWith('==') || trimmed.startsWith('=')) return '=';
    if (trimmed && /^[0-9၀-၉]/.test(trimmed)) return '=';
    return '';
  };

  const activeOp = activeMode === 'amount' ? getActiveOperator(searchQuery) : '';

  const handleApplyOperator = (op: string) => {
    const trimmed = searchQuery.trim();
    const withoutOp = trimmed.replace(/^(?:>=|<=|=>|=<|!=|<>|==|>|<|=)\s*/, '');
    if (op === '=') {
      onSearchChange(withoutOp ? `= ${withoutOp}` : '= ');
    } else {
      onSearchChange(withoutOp ? `${op} ${withoutOp}` : `${op} `);
    }
  };

  return (
    <div id="search-control-container" className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-xs">
      {/* Single compact row: Left (Column Select + Search Input) & Right (Rule Badge + Override Button) */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-1.5">
        {/* Left Side: Column Dropdown & Search Input */}
        <div className="flex flex-1 items-center gap-1.5 min-w-0">
          {/* Column Dropdown Selector */}
          <div className="w-44 sm:w-52 shrink-0">
            <select
              id="column-select-dropdown"
              value={selectedColumn}
              onChange={(e) => onSelectColumn(e.target.value)}
              className="w-full px-2 py-1 bg-slate-50 hover:bg-slate-100/80 border border-slate-300 rounded-md text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all cursor-pointer truncate"
              title="Select Column"
            >
              {columns.map((col) => {
                if (col === ALL_COLUMNS_KEY) {
                  return (
                    <option key={col} value={col}>
                      🔍 All Columns (Any Field)
                    </option>
                  );
                }

                return (
                  <option key={col} value={col}>
                    {col}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Search Query Input */}
          <div className="relative flex-1 min-w-0">
            <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-slate-400">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              id="search-input-field"
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={
                selectedColumn === ALL_COLUMNS_KEY
                  ? 'Search anything across all fields...'
                  : activeMode === 'amount'
                  ? 'Enter amount (e.g. > 10000, < 50000, = 300000 or 300000)...'
                  : activeMode === 'nrc'
                  ? 'Enter NRC last 6 digits...'
                  : activeMode === 'phone'
                  ? 'Enter last 6+ digits of Phone...'
                  : `Search in "${selectedColumn}"...`
              }
              className="w-full pl-7 pr-7 py-1 bg-slate-50 border border-slate-300 rounded-md text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
            />
            {searchQuery && (
              <button
                id="btn-clear-search"
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title="Clear Search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Operator Pills for Amount mode */}
          {activeMode === 'amount' && (
            <div
              id="amount-quick-operators"
              className="hidden sm:flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-md border border-slate-200 shrink-0"
              title="Quick Amount Operators"
            >
              {(['=', '>', '>=', '<', '<='] as const).map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => handleApplyOperator(op)}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold transition-all cursor-pointer ${
                    activeOp === op
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-white hover:text-slate-900'
                  }`}
                  title={`Filter Amount ${op}`}
                >
                  {op}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Rule Badge & Override Toggle */}
        <div className="flex items-center gap-1.5 shrink-0 justify-end">
          <div
            id="active-rule-badge"
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${currentBadge.badgeClass}`}
            title={`Active Rule: ${currentBadge.label}`}
          >
            <BadgeIcon className="w-3 h-3 shrink-0" />
            <span className="whitespace-nowrap">{currentBadge.label}</span>
          </div>

          <button
            id="btn-toggle-override"
            type="button"
            onClick={() => setShowModeOverride(!showModeOverride)}
            className={`p-1 rounded-md border text-xs font-medium transition-colors cursor-pointer ${
              showModeOverride
                ? 'bg-slate-200 border-slate-300 text-slate-800'
                : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
            }`}
            title="Change rule mode"
          >
            <SlidersHorizontal className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Mode Override Bar (Only shown when toggled) */}
      {showModeOverride && (
        <div id="mode-override-bar" className="mt-1.5 pt-1.5 border-t border-slate-100 flex flex-wrap items-center gap-1 text-xs">
          <span className="text-slate-500 text-[11px] font-medium">Rule Mode:</span>
          <button
            id="btn-mode-amount"
            type="button"
            onClick={() => onModeChange('amount')}
            className={`px-2 py-0.5 rounded-md border text-xs transition-all cursor-pointer ${
              activeMode === 'amount'
                ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Amount (&gt;, &lt;, =)
          </button>
          <button
            id="btn-mode-nrc"
            type="button"
            onClick={() => onModeChange('nrc')}
            className={`px-2 py-0.5 rounded-md border text-xs transition-all cursor-pointer ${
              activeMode === 'nrc'
                ? 'bg-indigo-600 text-white border-indigo-600 font-semibold shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            NRC 6 Digits
          </button>
          <button
            id="btn-mode-phone"
            type="button"
            onClick={() => onModeChange('phone')}
            className={`px-2 py-0.5 rounded-md border text-xs transition-all cursor-pointer ${
              activeMode === 'phone'
                ? 'bg-emerald-600 text-white border-emerald-600 font-semibold shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Phone 6+ Digits
          </button>
          <button
            id="btn-mode-fuzzy"
            type="button"
            onClick={() => onModeChange('fuzzy')}
            className={`px-2 py-0.5 rounded-md border text-xs transition-all cursor-pointer ${
              activeMode === 'fuzzy'
                ? 'bg-amber-600 text-white border-amber-600 font-semibold shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Fuzzy Match
          </button>
        </div>
      )}

      {/* Compact Myanmar Digits Notification (if applicable) */}
      {hasMyanmarDigits && (
        <div className="mt-1 pt-1 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-emerald-700">
          <span>✓ Myanmar numerals normalized:</span>
          <span className="font-mono bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200 font-semibold">
            {convertedQuery}
          </span>
        </div>
      )}
    </div>
  );
};
