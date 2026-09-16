import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { ExcelWorkbookData, SheetDetail, ColumnInfo } from '../types';
import { detectColumnMode } from '../utils/searchMatcher';
import { generateSampleWorkbook } from '../utils/sampleData';
import { generateSettlementSampleWorkbook } from '../utils/settlementXmlSample';
import { parseXmlStringToWorkbook } from '../utils/xmlParser';
import { FileSpreadsheet, Upload, Sparkles, RefreshCw, FileCode, CheckCircle2 } from 'lucide-react';

interface FileUploaderProps {
  workbookData: ExcelWorkbookData | null;
  onWorkbookLoaded: (data: ExcelWorkbookData) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  workbookData,
  onWorkbookLoaded,
  isLoading,
  setIsLoading,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const processWorkbook = (workbook: XLSX.WorkBook, fileName: string) => {
    try {
      const sheetNames = workbook.SheetNames;
      if (sheetNames.length === 0) {
        setErrorMessage('No worksheets found in this Excel file.');
        return;
      }

      const sheetsMap: Record<string, SheetDetail> = {};

      sheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        const columns = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];

        const columnInfos: ColumnInfo[] = columns.map((col) => ({
          name: col,
          detectedMode: detectColumnMode(col),
          sampleValues: rawRows.slice(0, 3).map((r) => String(r[col] || '')),
        }));

        sheetsMap[sheetName] = {
          name: sheetName,
          columns,
          columnInfos,
          rows: rawRows,
        };
      });

      const firstSheetWithData =
        sheetNames.find((name) => sheetsMap[name].rows.length > 0) || sheetNames[0];

      onWorkbookLoaded({
        fileName,
        sheetNames,
        activeSheetName: firstSheetWithData,
        sheets: sheetsMap,
      });
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(`Failed to parse file: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFile = (file: File) => {
    setIsLoading(true);
    setErrorMessage(null);

    const isXml = file.name.toLowerCase().endsWith('.xml');

    if (isXml) {
      // Parse XML file (e.g. MERCHANT_SETTLEMENT_*.xml or any clearing XML)
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const parsedWb = parseXmlStringToWorkbook(text, file.name);
          onWorkbookLoaded(parsedWb);
          setErrorMessage(null);
        } catch (err: any) {
          setErrorMessage(`Unable to parse XML file: ${err.message}`);
        } finally {
          setIsLoading(false);
        }
      };

      reader.onerror = () => {
        setErrorMessage('Failed to read XML file from disk.');
        setIsLoading(false);
      };

      reader.readAsText(file);
      return;
    }

    // Default Excel / CSV parser
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        const workbook = XLSX.read(buffer, { type: 'array' });
        processWorkbook(workbook, file.name);
      } catch (err: any) {
        setErrorMessage(`Unable to read spreadsheet: ${err.message}`);
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      setErrorMessage('File read error encountered.');
      setIsLoading(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFile(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const loadSample = () => {
    setIsLoading(true);
    setTimeout(() => {
      onWorkbookLoaded(generateSampleWorkbook());
      setErrorMessage(null);
      setIsLoading(false);
    }, 150);
  };

  const loadSettlementXml = () => {
    setIsLoading(true);
    setTimeout(() => {
      try {
        onWorkbookLoaded(generateSettlementSampleWorkbook());
        setErrorMessage(null);
      } catch (err: any) {
        setErrorMessage(`Failed to load settlement XML sample: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    }, 150);
  };

  const activeSheet = workbookData ? workbookData.sheets[workbookData.activeSheetName] : null;
  const isXmlFile = workbookData?.fileName.toLowerCase().endsWith('.xml');

  return (
    <div id="file-uploader-section" className="w-full">
      {workbookData ? (
        // Loaded state summary bar - Compact
        <div
          id="loaded-file-summary"
          className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 flex flex-wrap items-center justify-between gap-2 shadow-xs"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {isXmlFile ? (
              <FileCode className="w-4 h-4 text-amber-600 shrink-0" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span
              className="font-semibold text-slate-800 text-xs truncate max-w-[180px] sm:max-w-xs font-mono"
              title={workbookData.fileName}
            >
              {workbookData.fileName}
            </span>
            <span className="text-[11px] text-slate-400 hidden sm:inline">•</span>
            <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
              {activeSheet ? activeSheet.rows.length.toLocaleString() : 0} rows, {activeSheet ? activeSheet.columns.length : 0} cols
            </span>
            {isXmlFile && (
              <span className="px-1.5 py-0.2 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-semibold">
                XML Clearing Data
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              id="btn-load-settlement-sample"
              type="button"
              onClick={loadSettlementXml}
              className="px-2 py-0.5 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded transition-colors flex items-center gap-1 cursor-pointer"
              title="Load MERCHANT_SETTLEMENT XML Data"
            >
              <FileCode className="w-3 h-3 text-amber-600" />
              <span>Settlement XML</span>
            </button>
            <button
              id="btn-load-sample"
              type="button"
              onClick={loadSample}
              className="px-2 py-0.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition-colors flex items-center gap-1 cursor-pointer"
              title="Load sample dataset"
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Excel Sample</span>
            </button>
            <button
              id="btn-upload-new-file"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2 py-0.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Upload className="w-3 h-3" />
              <span>Upload File</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv, .xml"
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>
        </div>
      ) : (
        // Empty upload dropzone
        <div
          id="dropzone-card"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all bg-white ${
            isDragging
              ? 'border-emerald-500 bg-emerald-50/50 scale-[1.005]'
              : 'border-slate-300 hover:border-slate-400'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv, .xml"
            onChange={handleFileInputChange}
            className="hidden"
            id="excel-file-input"
          />

          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-xs">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shadow-xs">
              <FileCode className="w-6 h-6" />
            </div>
          </div>

          <h3 className="text-lg font-semibold text-slate-800 mb-1">
            Import Excel (.xlsx, .xls), CSV, or XML Files
          </h3>
          <p className="text-sm text-slate-500 max-w-lg mx-auto mb-6">
            Drag and drop your spreadsheet or settlement XML file (such as <code className="text-xs bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">MERCHANT_SETTLEMENT_*.xml</code>) here, or browse from your computer.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button
              id="btn-browse-file"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              Browse Excel / XML File
            </button>

            <button
              id="btn-load-settlement-hero"
              type="button"
              onClick={loadSettlementXml}
              className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-medium text-sm rounded-xl transition-colors flex items-center gap-2 border border-amber-200 cursor-pointer"
            >
              <FileCode className="w-4 h-4 text-amber-600" />
              Load Settlement XML (4203)
            </button>

            <button
              id="btn-load-sample-hero"
              type="button"
              onClick={loadSample}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm rounded-xl transition-colors flex items-center gap-2 border border-slate-200 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              Sample Excel
            </button>
          </div>

          {isLoading && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-emerald-700 font-medium">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Parsing file contents & worksheets...
            </div>
          )}

          {errorMessage && (
            <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
              {errorMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
