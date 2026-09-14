import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { ExcelWorkbookData, SheetDetail, ColumnInfo } from '../types';
import { detectColumnMode } from '../utils/searchMatcher';
import { generateSampleWorkbook } from '../utils/sampleData';
import { FileSpreadsheet, Upload, Sparkles, RefreshCw, FileCheck } from 'lucide-react';

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
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        const workbook = XLSX.read(buffer, { type: 'array' });
        processWorkbook(workbook, file.name);
      } catch (err: any) {
        setErrorMessage(`Unable to read Excel file: ${err.message}`);
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

  const activeSheet = workbookData ? workbookData.sheets[workbookData.activeSheetName] : null;

  return (
    <div id="file-uploader-section" className="w-full">
      {workbookData ? (
        // Loaded state summary bar
        <div
          id="loaded-file-summary"
          className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800 text-sm md:text-base">
                  {workbookData.fileName}
                </span>
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                  <FileCheck className="w-3 h-3" /> Ready
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                <span>Total Sheets: <strong className="text-slate-700">{workbookData.sheetNames.length}</strong></span>
                <span>•</span>
                <span>Active Sheet: <strong className="text-slate-800 font-semibold">{workbookData.activeSheetName}</strong></span>
                <span>•</span>
                <span>Rows: <strong className="text-slate-700">{activeSheet ? activeSheet.rows.length.toLocaleString() : 0}</strong></span>
                <span>•</span>
                <span>Columns: <strong className="text-slate-700">{activeSheet ? activeSheet.columns.length : 0}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button
              id="btn-load-sample"
              type="button"
              onClick={loadSample}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
              title="Load multi-sheet sample dataset"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Sample Data
            </button>
            <button
              id="btn-upload-new-file"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload New File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
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
            accept=".xlsx, .xls, .csv"
            onChange={handleFileInputChange}
            className="hidden"
            id="excel-file-input"
          />

          <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-4 shadow-xs">
            <FileSpreadsheet className="w-7 h-7" />
          </div>

          <h3 className="text-lg font-semibold text-slate-800 mb-1">
            Import Excel or CSV Spreadsheet
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            Drag and drop your Excel file (.xlsx, .xls) or CSV file here, or browse from your computer. Supports multi-sheet workbooks.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              id="btn-browse-file"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl shadow-xs transition-colors flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Browse Excel File
            </button>

            <button
              id="btn-load-sample-hero"
              type="button"
              onClick={loadSample}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm rounded-xl transition-colors flex items-center gap-2 border border-slate-200"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              Load Sample Data
            </button>
          </div>

          {isLoading && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-emerald-700 font-medium">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Parsing Excel workbook sheets...
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
