import { useState, useMemo, useEffect } from 'react';
import { ExcelWorkbookData, SearchMode, MatchResult, SheetDetail, ColumnInfo, ALL_SHEETS_TAB_ID, ALL_COLUMNS_KEY } from './types';
import { generateSampleWorkbook } from './utils/sampleData';
import { detectColumnMode, evaluateRowMatch } from './utils/searchMatcher';
import { FileUploader } from './components/FileUploader';
import { SheetTabs } from './components/SheetTabs';
import { SearchControl } from './components/SearchControl';
import { ResultsTable } from './components/ResultsTable';
import { DetailModal } from './components/DetailModal';
import { FileSpreadsheet } from 'lucide-react';

export default function App() {
  const [workbookData, setWorkbookData] = useState<ExcelWorkbookData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeSheetName, setActiveSheetName] = useState<string>('');
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [activeMode, setActiveMode] = useState<SearchMode>('fuzzy');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeDetailRow, setActiveDetailRow] = useState<Record<string, any> | null>(null);

  // Initialize with multi-sheet sample workbook
  useEffect(() => {
    const sample = generateSampleWorkbook();
    setWorkbookData(sample);
    setActiveSheetName(sample.activeSheetName);

    const firstSheet = sample.sheets[sample.activeSheetName];
    if (firstSheet && firstSheet.columns.length > 0) {
      const nrcCol = firstSheet.columns.find((c) => detectColumnMode(c) === 'nrc') || firstSheet.columns[1] || firstSheet.columns[0];
      setSelectedColumn(nrcCol);
      setActiveMode(detectColumnMode(nrcCol));
    }
  }, []);

  // When a new workbook is loaded
  const handleWorkbookLoaded = (data: ExcelWorkbookData) => {
    setWorkbookData(data);
    setActiveSheetName(data.activeSheetName);
    setSearchQuery('');

    const currentSheet = data.sheets[data.activeSheetName];
    if (currentSheet && currentSheet.columns.length > 0) {
      const nrcCol = currentSheet.columns.find((c) => detectColumnMode(c) === 'nrc') || currentSheet.columns[0];
      setSelectedColumn(nrcCol);
      setActiveMode(detectColumnMode(nrcCol));
    }
  };

  // When switching sheet tabs (supports individual sheet or All Sheets)
  const handleSelectSheet = (sheetName: string) => {
    if (!workbookData) return;
    if (sheetName !== ALL_SHEETS_TAB_ID && !workbookData.sheets[sheetName]) return;

    setActiveSheetName(sheetName);
    setSearchQuery('');

    if (sheetName === ALL_SHEETS_TAB_ID) {
      setSelectedColumn(ALL_COLUMNS_KEY);
      setActiveMode('fuzzy');
    } else {
      const targetSheet = workbookData.sheets[sheetName];
      if (targetSheet.columns.length > 0) {
        const nrcCol = targetSheet.columns.find((c) => detectColumnMode(c) === 'nrc') || targetSheet.columns[0];
        setSelectedColumn(nrcCol);
        setActiveMode(detectColumnMode(nrcCol));
      }
    }
  };

  // When column changes in dropdown, auto-detect mode
  const handleSelectColumn = (col: string) => {
    setSelectedColumn(col);
    if (col === ALL_COLUMNS_KEY) {
      setActiveMode('fuzzy');
    } else {
      const detected = detectColumnMode(col);
      setActiveMode(detected);
    }
  };

  // Active sheet details (either single sheet or virtual combined "All Sheets")
  const currentSheet = useMemo<SheetDetail | null>(() => {
    if (!workbookData) return null;

    if (activeSheetName === ALL_SHEETS_TAB_ID) {
      const allRows: Record<string, any>[] = [];
      const colSet = new Set<string>();

      for (const sName of workbookData.sheetNames) {
        const s = workbookData.sheets[sName];
        if (s) {
          for (const col of s.columns) {
            colSet.add(col);
          }
          for (const r of s.rows) {
            allRows.push({
              ...r,
              _sheetName: sName,
            });
          }
        }
      }

      const uniqueCols = Array.from(colSet);
      const columns = [ALL_COLUMNS_KEY, ...uniqueCols];

      const columnInfos: ColumnInfo[] = [
        {
          name: ALL_COLUMNS_KEY,
          detectedMode: 'fuzzy',
          sampleValues: ['Search across all columns in all worksheets'],
        },
        ...uniqueCols.map((col) => ({
          name: col,
          detectedMode: detectColumnMode(col),
          sampleValues: allRows.slice(0, 3).map((r) => String(r[col] || '')),
        })),
      ];

      return {
        name: 'All Sheets',
        columns,
        columnInfos,
        rows: allRows,
      };
    }

    return workbookData.sheets[activeSheetName] || null;
  }, [workbookData, activeSheetName]);

  // Evaluate matching for each row in active sheet or all combined sheets
  const matchResults = useMemo<MatchResult[]>(() => {
    if (!currentSheet || !selectedColumn) return [];

    const query = searchQuery.trim();
    if (!query) {
      return currentSheet.rows.map((row, idx) => ({
        row,
        rowIndex: idx,
        sheetName: row._sheetName,
        matched: true,
        score: 100,
        matchReason: 'All records displayed',
      }));
    }

    const evaluated = currentSheet.rows
      .map((row, idx) => {
        const res = evaluateRowMatch(row, selectedColumn, activeMode, query);
        return {
          ...res,
          rowIndex: idx,
          sheetName: row._sheetName,
        };
      })
      .filter((item) => item.matched);

    // Sort by match score descending
    return evaluated.sort((a, b) => b.score - a.score);
  }, [currentSheet, selectedColumn, activeMode, searchQuery]);


  return (
    <div className="bg-slate-50 text-slate-800 flex flex-col min-h-screen">
      {/* Top Application Bar - Compact & Clean */}
      <header className="bg-white border-b border-slate-200 shrink-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-5 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <FileSpreadsheet className="w-3.5 h-3.5" />
            </div>
            <h1 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
              Excel Column Search & Matcher
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main
        className={
          workbookData
            ? 'flex-1 max-w-7xl w-full mx-auto px-2.5 sm:px-5 py-2 flex flex-col gap-2'
            : 'flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-4'
        }
      >
        {/* File Upload Section */}
        <div className="shrink-0">
          <FileUploader
            workbookData={workbookData}
            onWorkbookLoaded={handleWorkbookLoaded}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
          />
        </div>

        {/* Multi-Sheet Tab Navigation */}
        {workbookData && workbookData.sheetNames.length > 0 && (
          <div className="shrink-0">
            <SheetTabs
              sheetNames={workbookData.sheetNames}
              activeSheetName={activeSheetName}
              sheets={workbookData.sheets}
              onSelectSheet={handleSelectSheet}
            />
          </div>
        )}

        {/* Search Controls (Dropdown & Input & Rule explanation) */}
        {currentSheet && (
          <>
            <div className="shrink-0">
              <SearchControl
                columns={currentSheet.columns}
                columnInfos={currentSheet.columnInfos}
                selectedColumn={selectedColumn}
                onSelectColumn={handleSelectColumn}
                activeMode={activeMode}
                onModeChange={setActiveMode}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                totalRows={currentSheet.rows.length}
                matchedCount={matchResults.length}
              />
            </div>

            {/* Results Table with Permanently Frozen Header */}
            <ResultsTable
              columns={currentSheet.columns}
              results={matchResults}
              selectedColumn={selectedColumn}
              activeMode={activeMode}
              searchQuery={searchQuery}
              onSelectRow={(row) => setActiveDetailRow(row)}
              fileName={workbookData?.fileName || 'Workbook.xlsx'}
              activeSheetName={activeSheetName}
            />
          </>
        )}
      </main>

      {/* Row Detail Inspection Modal */}
      <DetailModal
        row={activeDetailRow}
        onClose={() => setActiveDetailRow(null)}
        selectedColumn={selectedColumn}
      />

      {/* Compact Footer */}
      <footer className="border-t border-slate-200 bg-white py-1 px-3 text-center text-[10px] text-slate-400 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span>Excel Column Search & Matcher</span>
          <span>Myanmar (၀-၉) & English (0-9) Normalization</span>
        </div>
      </footer>
    </div>
  );
}
