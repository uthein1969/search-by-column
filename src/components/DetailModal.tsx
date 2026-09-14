import React from 'react';
import { X, Copy, Check } from 'lucide-react';

interface DetailModalProps {
  row: Record<string, any> | null;
  onClose: () => void;
  selectedColumn: string;
}

export const DetailModal: React.FC<DetailModalProps> = ({ row, onClose, selectedColumn }) => {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  if (!row) return null;

  const handleCopy = (key: string, val: any) => {
    navigator.clipboard.writeText(String(val ?? ''));
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <div
      id="detail-modal-overlay"
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        id="detail-modal-card"
        className="bg-white rounded-2xl max-w-xl w-full max-h-[85vh] shadow-xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-800 text-base">
                Full Record Information
              </h3>
              {row._sheetName && (
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                  Sheet: {row._sheetName}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Detailed column attributes for the selected row
            </p>
          </div>
          <button
            id="btn-close-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-2.5 divide-y divide-slate-100 text-sm">
          {Object.entries(row)
            .filter(([key]) => !key.startsWith('_'))
            .map(([key, val]) => {
            const isSelected = key === selectedColumn;
            return (
              <div
                key={key}
                className={`pt-2.5 first:pt-0 flex items-start justify-between gap-3 ${
                  isSelected ? 'bg-amber-50/70 p-2.5 rounded-xl border border-amber-200' : ''
                }`}
              >
                <div className="w-1/3 shrink-0">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">
                    {key}
                  </span>
                  {isSelected && (
                    <span className="inline-block mt-0.5 text-[10px] text-amber-800 font-medium bg-amber-100 px-1.5 py-0.2 rounded">
                      Searched Column
                    </span>
                  )}
                </div>

                <div className="flex-1 text-slate-800 break-words font-medium text-sm">
                  {val !== null && val !== undefined && String(val) !== '' ? (
                    String(val)
                  ) : (
                    <em className="text-slate-400">Empty</em>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(key, val)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
                  title="Copy value"
                >
                  {copiedKey === key ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-medium rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
