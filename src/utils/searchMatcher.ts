import { SearchMode, MatchResult, ALL_COLUMNS_KEY, TextMatchOption } from '../types';
import {
  convertMyanmarToEnglishDigits,
  extractDigits,
  normalizePhoneNumber,
  parseAmount,
  parseAmountQuery,
  isAmountColumn,
  formatAmountValue,
} from './numberUtils';

/**
 * Auto-detects search mode based on column header text
 */
export function detectColumnMode(columnName: string): SearchMode {
  const lower = columnName.toLowerCase().trim();

  // Exclude Currency code columns (e.g. OPER_AMOUNT_CUR, STTL_AMOUNT_CUR) from amount mode
  if (
    lower.includes('_cur') ||
    lower.includes('cur_') ||
    lower.endsWith('_cur') ||
    lower.includes('currency') ||
    lower.includes('_ccy') ||
    lower === 'cur' ||
    /\bcur\b/i.test(columnName)
  ) {
    return 'fuzzy';
  }

  // Check for Amount / Currency / Balance / Price / Total / Fee / Minor Units
  if (
    lower.includes('amount') ||
    lower.includes('amt') ||
    lower.includes('price') ||
    lower.includes('balance') ||
    lower.includes('total') ||
    lower.includes('fee') ||
    lower.includes('cost') ||
    lower.includes('charge') ||
    lower.includes('salary') ||
    lower.includes('payment') ||
    lower.includes('deposit') ||
    lower.includes('withdraw') ||
    lower.includes('sum') ||
    lower.startsWith('add_ampr') ||
    lower.includes('ampr') ||
    lower.endsWith('_val') ||
    lower.includes('ပမာဏ') ||
    lower.includes('ငွေပမာဏ') ||
    lower.includes('ကျသင့်ငွေ')
  ) {
    return 'amount';
  }

  // Check for Phone / Card / Token / Refnum digits
  if (
    lower.includes('phone') ||
    lower.includes('mobile') ||
    lower.includes('tel') ||
    lower.includes('ph no') ||
    lower.includes('ph_no') ||
    lower.includes('card') ||
    lower.includes('token') ||
    lower.includes('refnum') ||
    lower.includes('ဖုန်း') ||
    lower === 'ph'
  ) {
    return 'phone';
  }

  // Check for NRC / National ID
  if (
    lower.includes('nrc') ||
    lower.includes('national id') ||
    lower.includes('cid') ||
    lower.includes('n.r.c') ||
    lower.includes('မှတ်ပုံတင်') ||
    lower.includes('citizen')
  ) {
    return 'nrc';
  }

  return 'fuzzy';
}

/**
 * Calculates Levenshtein Distance for fuzzy string comparison
 */
export function calculateLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Bigram Dice Coefficient for fuzzy similarity (0.0 to 1.0)
 */
export function calculateDiceSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/\s+/g, '');
  const s2 = str2.toLowerCase().replace(/\s+/g, '');

  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) {
    return s1.includes(s2) || s2.includes(s1) ? 0.7 : 0;
  }

  const bigrams1 = new Map<string, number>();
  for (let i = 0; i < s1.length - 1; i++) {
    const bigram = s1.substring(i, i + 2);
    bigrams1.set(bigram, (bigrams1.get(bigram) || 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    const bigram = s2.substring(i, i + 2);
    const count = bigrams1.get(bigram) || 0;
    if (count > 0) {
      bigrams1.set(bigram, count - 1);
      intersection++;
    }
  }

  return (2.0 * intersection) / (s1.length - 1 + s2.length - 1);
}

/**
 * Combines substring containment and fuzzy algorithms
 */
export function calculateFuzzyScore(query: string, target: string): number {
  if (!query || !target) return 0;

  const q = query.trim().toLowerCase();
  const t = target.trim().toLowerCase();

  // Exact match
  if (t === q) return 100;

  // Substring match
  if (t.includes(q)) {
    const ratio = q.length / t.length;
    return Math.round(80 + ratio * 20);
  }

  // Token matching (words)
  const qTokens = q.split(/\s+/).filter(Boolean);
  const matchedTokens = qTokens.filter((token) => t.includes(token));
  if (qTokens.length > 0 && matchedTokens.length === qTokens.length) {
    return 85;
  }

  // Dice bigram similarity
  const dice = calculateDiceSimilarity(q, t);

  // Levenshtein similarity
  const maxLen = Math.max(q.length, t.length);
  const levDist = calculateLevenshtein(q, t);
  const levSim = maxLen > 0 ? (maxLen - levDist) / maxLen : 0;

  const combined = Math.max(dice, levSim);
  return Math.round(combined * 100);
}

/**
 * Executes NRC / Passport search matching (Last 6 digits rule + typo tolerance + leading zero normalization + passport text)
 */
export function matchNRC(
  cellValue: any,
  query: string
): { matched: boolean; score: number; reason: string; matchedDigits?: string } {
  if (cellValue === null || cellValue === undefined) {
    return { matched: false, score: 0, reason: 'Empty' };
  }

  const cellText = String(cellValue).trim();
  const rawQuery = query.trim();

  if (!rawQuery) {
    return { matched: true, score: 100, reason: 'All' };
  }

  const cellDigits = extractDigits(cellText);
  const queryDigits = extractDigits(rawQuery);

  // Normalized alphanumeric representations (for passport or full NRC text matching)
  const normCell = convertMyanmarToEnglishDigits(cellText).toLowerCase().replace(/[\s\-\/\(\)]/g, '');
  const normQuery = convertMyanmarToEnglishDigits(rawQuery).toLowerCase().replace(/[\s\-\/\(\)]/g, '');

  // 1. Full text / Passport exact match
  if (normCell === normQuery && normQuery.length > 0) {
    return {
      matched: true,
      score: 100,
      reason: `NRC / Passport exact match [${cellText}]`,
      matchedDigits: cellDigits.length >= 6 ? cellDigits.slice(-6) : queryDigits,
    };
  }

  // 2. Full text / Passport substring containment
  if (normQuery.length >= 3 && normCell.includes(normQuery)) {
    return {
      matched: true,
      score: 95,
      reason: `NRC / Passport contains "${rawQuery}"`,
      matchedDigits: cellDigits.length >= 6 ? cellDigits.slice(-6) : queryDigits,
    };
  }

  // Last 6 digits of the cell NRC
  const cellLast6 = cellDigits.length >= 6 ? cellDigits.slice(-6) : cellDigits;
  // Query might be 6 digits, 7 digits, or full NRC string
  const queryLast6 = queryDigits.length >= 6 ? queryDigits.slice(-6) : queryDigits;

  // 3. Exact match on last 6 digits (e.g. cell has 054079 and query has 054079)
  if (cellLast6.length === 6 && queryLast6.length === 6 && cellLast6 === queryLast6) {
    return {
      matched: true,
      score: 100,
      reason: `NRC exact last 6 digits match [${cellLast6}]`,
      matchedDigits: cellLast6,
    };
  }

  // 4. Exact match on cellLast6 when queryDigits has >= 6 digits:
  // e.g. Query has 7 digits like "0540079", or query ends with / contains cellLast6
  if (queryDigits.length >= 6 && cellLast6.length >= 5) {
    // Check if cell full digits ends with query digits (e.g. user entered state number + digits: 12054079)
    if (cellDigits.endsWith(queryDigits)) {
      return {
        matched: true,
        score: 100,
        reason: `NRC digits end with [${queryDigits}]`,
        matchedDigits: queryDigits,
      };
    }

    // Check if query ends with cell last 6 digits
    if (queryDigits.endsWith(cellLast6)) {
      return {
        matched: true,
        score: 98,
        reason: `NRC last 6 digits [${cellLast6}] match query`,
        matchedDigits: cellLast6,
      };
    }

    // Check if query contains cell last 6 digits
    if (queryDigits.includes(cellLast6)) {
      return {
        matched: true,
        score: 95,
        reason: `NRC last 6 digits [${cellLast6}] matched in query`,
        matchedDigits: cellLast6,
      };
    }

    // Check if first 6 digits of query matches cell last 6 digits
    if (queryDigits.slice(0, 6) === cellLast6) {
      return {
        matched: true,
        score: 95,
        reason: `NRC last 6 digits [${cellLast6}] matches query prefix`,
        matchedDigits: cellLast6,
      };
    }
  }

  // 5. Leading zero normalization:
  // e.g. cell has "054079" -> without leading zero: "54079"
  // user might search "54079" or "0054079"
  const cellCleanNum = cellLast6.replace(/^0+/, '');
  const queryCleanNum = queryDigits.replace(/^0+/, '');
  if (
    cellCleanNum.length >= 4 &&
    queryCleanNum.length >= 4 &&
    cellCleanNum === queryCleanNum
  ) {
    return {
      matched: true,
      score: 95,
      reason: `NRC digits match (leading zero normalized: [${cellLast6}])`,
      matchedDigits: cellLast6,
    };
  }

  // 6. Typo / Levenshtein tolerance for digits
  // Handles cases like query "0540079" (7 digits, duplicate 0 typo) vs cell "054079" (6 digits)
  if (queryDigits.length >= 5 && cellLast6.length >= 5) {
    const levFull = calculateLevenshtein(queryDigits, cellLast6);
    const levLast6 = calculateLevenshtein(queryLast6, cellLast6);
    const minLev = Math.min(levFull, levLast6);

    if (minLev <= 1) {
      return {
        matched: true,
        score: 90,
        reason: `NRC near match [${cellLast6}] (1 digit variation: query "${queryDigits}")`,
        matchedDigits: cellLast6,
      };
    }
  }

  // 7. Partial digits match if user entered fewer than 6 digits:
  if (queryDigits.length > 0 && queryDigits.length < 6) {
    if (cellLast6.endsWith(queryDigits)) {
      return {
        matched: true,
        score: 85,
        reason: `NRC last digits [${cellLast6}] ends with [${queryDigits}]`,
        matchedDigits: queryDigits,
      };
    }
    if (cellLast6.includes(queryDigits)) {
      return {
        matched: true,
        score: 75,
        reason: `NRC last digits [${cellLast6}] contains [${queryDigits}]`,
        matchedDigits: queryDigits,
      };
    }
    if (cellDigits.includes(queryDigits)) {
      return {
        matched: true,
        score: 70,
        reason: `NRC contains digits [${queryDigits}]`,
        matchedDigits: queryDigits,
      };
    }
  }

  // 8. Fuzzy text similarity fallback
  const fuzzy = calculateFuzzyScore(rawQuery, cellText);
  if (fuzzy >= 75) {
    return {
      matched: true,
      score: fuzzy,
      reason: `NRC / Passport approximate match (${fuzzy}%)`,
      matchedDigits: cellLast6,
    };
  }

  return { matched: false, score: 0, reason: 'No match' };
}

/**
 * Executes Phone search matching (At least last 6 digits rule)
 */
export function matchPhone(cellValue: any, query: string): { matched: boolean; score: number; reason: string; matchedDigits?: string } {
  if (cellValue === null || cellValue === undefined) {
    return { matched: false, score: 0, reason: 'Empty' };
  }

  normalizePhoneNumber(cellValue);
  const queryDigits = extractDigits(query);

  if (!queryDigits) {
    return { matched: true, score: 100, reason: 'All' };
  }

  const cellDigits = extractDigits(cellValue);

  // If query has >= 6 digits
  if (queryDigits.length >= 6) {
    if (cellDigits.endsWith(queryDigits)) {
      return {
        matched: true,
        score: 100,
        reason: `Phone last ${queryDigits.length} digits exact match [${queryDigits}]`,
        matchedDigits: queryDigits,
      };
    }

    // Compare last 6 digits of both
    const cellLast6 = cellDigits.slice(-6);
    const queryLast6 = queryDigits.slice(-6);
    if (cellLast6 === queryLast6) {
      return {
        matched: true,
        score: 95,
        reason: `Phone last 6 digits match [${cellLast6}]`,
        matchedDigits: cellLast6,
      };
    }

    if (cellDigits.includes(queryDigits)) {
      return {
        matched: true,
        score: 80,
        reason: `Phone contains digits [${queryDigits}]`,
        matchedDigits: queryDigits,
      };
    }
  } else {
    // Query has less than 6 digits
    if (cellDigits.endsWith(queryDigits)) {
      return {
        matched: true,
        score: 75,
        reason: `Phone ends with [${queryDigits}] (Rule requires at least 6 digits)`,
        matchedDigits: queryDigits,
      };
    }
    if (cellDigits.includes(queryDigits)) {
      return {
        matched: true,
        score: 60,
        reason: `Phone contains digits [${queryDigits}]`,
        matchedDigits: queryDigits,
      };
    }
  }

  return { matched: false, score: 0, reason: 'No match' };
}

/**
 * Executes Text / Name matching with user options: Equal, Contain, Like
 * - Equal: Case-insensitive exact match
 * - Contain: Substring containment
 * - Like: Wildcard (% or *), starts-with, word token and typo-tolerant similarity
 */
export function matchText(
  cellValue: any,
  query: string,
  option: TextMatchOption = 'contain'
): { matched: boolean; score: number; reason: string; highlightText?: string } {
  if (cellValue === null || cellValue === undefined) {
    return { matched: false, score: 0, reason: 'Empty' };
  }

  const cellText = String(cellValue).trim();
  const q = query.trim();

  if (!q) {
    return { matched: true, score: 100, reason: 'All' };
  }

  const normCell = cellText.toLowerCase();
  const normQ = q.toLowerCase();

  // 1. Equal: Exact match (case-insensitive, trimmed)
  if (option === 'equal') {
    if (normCell === normQ) {
      return {
        matched: true,
        score: 100,
        reason: `Equal (=): "${cellText}"`,
        highlightText: cellText,
      };
    }
    return { matched: false, score: 0, reason: `Does not equal "${q}"` };
  }

  // 2. Contain: Substring containment (case-insensitive)
  if (option === 'contain') {
    if (normCell.includes(normQ)) {
      const isExact = normCell === normQ;
      const ratio = normQ.length / Math.max(normCell.length, 1);
      const score = isExact ? 100 : Math.round(85 + ratio * 15);
      return {
        matched: true,
        score,
        reason: isExact ? `Exact match: "${cellText}"` : `Contains "${q}" in "${cellText}"`,
        highlightText: q,
      };
    }
    return { matched: false, score: 0, reason: `Does not contain "${q}"` };
  }

  // 3. Like: SQL LIKE pattern / starts-with / wildcard / similarity
  if (option === 'like') {
    // Check wildcard pattern with * or %
    if (normQ.includes('*') || normQ.includes('%')) {
      const pattern = '^' + normQ.replace(/[-\/\\^$+?.()|[\]{}]/g, '\\$&').replace(/[*%]/g, '.*') + '$';
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(normCell)) {
          return {
            matched: true,
            score: 95,
            reason: `LIKE pattern match ("${q}")`,
            highlightText: q.replace(/[*%]/g, ''),
          };
        }
      } catch {
        // ignore regex error
      }
    }

    // Direct containment
    if (normCell.includes(normQ)) {
      const isExact = normCell === normQ;
      return {
        matched: true,
        score: isExact ? 100 : 90,
        reason: isExact ? `Exact match: "${cellText}"` : `LIKE contains: "${q}"`,
        highlightText: q,
      };
    }

    // Word tokens match (e.g. all words present)
    const tokens = normQ.split(/\s+/).filter(Boolean);
    if (tokens.length > 1 && tokens.every((t) => normCell.includes(t))) {
      return {
        matched: true,
        score: 85,
        reason: `Matched words: [${tokens.join(', ')}]`,
        highlightText: tokens[0],
      };
    }

    // Fuzzy similarity (Dice & Levenshtein)
    const score = calculateFuzzyScore(normQ, normCell);
    if (score >= 60) {
      return {
        matched: true,
        score,
        reason: `Similar (${score}%): "${cellText}"`,
        highlightText: q,
      };
    }

    return { matched: false, score: 0, reason: `Not similar to "${q}"` };
  }

  return { matched: false, score: 0, reason: 'No match' };
}

/**
 * Executes Fuzzy / Approximate matching for any other columns
 */
export function matchFuzzy(cellValue: any, query: string, minThreshold: number = 40): { matched: boolean; score: number; reason: string } {
  return matchText(cellValue, query, 'like');
}

/**
 * Executes Numeric Amount comparison matching:
 * Supports operators: >, >=, <, <=, =, !=, and Range (e.g. 1000 - 50000).
 * Defaults to exact numeric equality '=' when user enters plain number (e.g. 300000).
 */
export function matchAmount(
  cellValue: any,
  query: string,
  divideBy100: boolean = false
): { matched: boolean; score: number; reason: string; formattedVal?: string } {
  if (cellValue === null || cellValue === undefined) {
    return { matched: false, score: 0, reason: 'Empty' };
  }

  const q = query.trim();
  if (!q) {
    return { matched: true, score: 100, reason: 'All' };
  }

  const rawNum = parseAmount(cellValue);
  const parsedQuery = parseAmountQuery(q);

  // If query could not be parsed as an amount query or operator,
  // fallback gracefully to fuzzy string matching (e.g. searching text in amount column)
  if (!parsedQuery.isValid) {
    const fuzzy = matchFuzzy(cellValue, q);
    return {
      matched: fuzzy.matched,
      score: fuzzy.score,
      reason: fuzzy.reason,
      formattedVal: String(cellValue),
    };
  }

  // If cell has no numeric value, it cannot match numeric amount
  if (rawNum === null) {
    return { matched: false, score: 0, reason: 'Non-numeric cell' };
  }

  const cellNum = divideBy100 ? rawNum / 100 : rawNum;

  const formattedCell = cellNum.toLocaleString(undefined, {
    minimumFractionDigits: divideBy100 || !Number.isInteger(cellNum) ? 2 : 0,
    maximumFractionDigits: 2,
  });

  const target = parsedQuery.value;
  const formattedTarget = target.toLocaleString(undefined, {
    minimumFractionDigits: Number.isInteger(target) ? 0 : 2,
    maximumFractionDigits: 2,
  });

  const EPSILON = 0.0001;
  let matched = false;
  let reason = '';

  switch (parsedQuery.operator) {
    case '>':
      matched = cellNum > target + EPSILON || (divideBy100 && rawNum > target + EPSILON);
      reason = `Amount > ${formattedTarget} (${formattedCell})`;
      break;
    case '>=':
      matched = cellNum >= target - EPSILON || (divideBy100 && rawNum >= target - EPSILON);
      reason = `Amount ≥ ${formattedTarget} (${formattedCell})`;
      break;
    case '<':
      matched = cellNum < target - EPSILON || (divideBy100 && rawNum < target - EPSILON);
      reason = `Amount < ${formattedTarget} (${formattedCell})`;
      break;
    case '<=':
      matched = cellNum <= target + EPSILON || (divideBy100 && rawNum <= target + EPSILON);
      reason = `Amount ≤ ${formattedTarget} (${formattedCell})`;
      break;
    case '!=':
      matched = Math.abs(cellNum - target) > EPSILON;
      reason = `Amount ≠ ${formattedTarget} (${formattedCell})`;
      break;
    case 'range':
      const target2 = parsedQuery.value2 ?? target;
      const formattedTarget2 = target2.toLocaleString(undefined, {
        minimumFractionDigits: Number.isInteger(target2) ? 0 : 2,
        maximumFractionDigits: 2,
      });
      matched =
        (cellNum >= target - EPSILON && cellNum <= target2 + EPSILON) ||
        (divideBy100 && rawNum >= target - EPSILON && rawNum <= target2 + EPSILON);
      reason = `Amount [${formattedTarget} - ${formattedTarget2}] (${formattedCell})`;
      break;
    case '=':
    default:
      if (Math.abs(cellNum - target) < EPSILON) {
        matched = true;
        reason = `Amount = ${formattedTarget} (Exact: ${formattedCell})`;
      } else if (Math.abs(rawNum - target) < EPSILON) {
        matched = true;
        reason = `Amount = ${formattedTarget} (Raw: ${cellValue})`;
      } else if (Math.abs(cellNum / 100 - target) < EPSILON) {
        matched = true;
        reason = `Amount = ${formattedTarget} (Matched raw minor unit: ${formattedCell})`;
      } else if (Math.abs(cellNum - target / 100) < EPSILON) {
        matched = true;
        reason = `Amount = ${formattedTarget} (Matched currency unit: ${formattedCell})`;
      }
      break;
  }

  if (matched) {
    return {
      matched: true,
      score: 100,
      reason,
      formattedVal: formattedCell,
    };
  }

  return {
    matched: false,
    score: 0,
    reason: `Amount does not match ${q}`,
    formattedVal: formattedCell,
  };
}

/**
 * Unified row matcher according to selected column and mode.
 * Supports ALL_COLUMNS_KEY for searching across all columns in a row.
 * Supports cross-sheet fallback if the selected column exists under a different header name.
 */
export function evaluateRowMatch(
  row: Record<string, any>,
  selectedColumn: string,
  mode: SearchMode,
  query: string,
  textOption: TextMatchOption = 'contain',
  divideBy100: boolean = false
): MatchResult {
  const sheetName = row._sheetName as string | undefined;

  if (!query || query.trim() === '') {
    return {
      row,
      rowIndex: 0,
      sheetName,
      matched: true,
      score: 100,
      matchReason: 'All records displayed',
    };
  }

  // Helper to match a specific cell value with given mode
  const testCell = (colName: string, val: any, colMode: SearchMode) => {
    if (colMode === 'amount') {
      const isAmt = isAmountColumn(colName);
      const res = matchAmount(val, query, divideBy100 && isAmt);
      return {
        matched: res.matched,
        score: res.score,
        reason: res.reason,
        highlightText: res.formattedVal,
        colName,
      };
    }
    if (colMode === 'nrc') {
      const res = matchNRC(val, query);
      return {
        matched: res.matched,
        score: res.score,
        reason: res.reason,
        highlightText: res.matchedDigits,
        colName,
      };
    }
    if (colMode === 'phone') {
      const res = matchPhone(val, query);
      return {
        matched: res.matched,
        score: res.score,
        reason: res.reason,
        highlightText: res.matchedDigits,
        colName,
      };
    }
    const res = matchText(val, query, textOption);
    return {
      matched: res.matched,
      score: res.score,
      reason: res.reason,
      highlightText: res.highlightText || query,
      colName,
    };
  };

  // Case 1: Search Across All Columns
  if (selectedColumn === ALL_COLUMNS_KEY) {
    let bestResult: {
      matched: boolean;
      score: number;
      reason: string;
      highlightText?: string;
      colName: string;
    } | null = null;

    for (const [key, val] of Object.entries(row)) {
      if (key.startsWith('_')) continue; // skip internal metadata like _sheetName
      if (val === null || val === undefined || String(val).trim() === '') continue;

      const colMode = detectColumnMode(key);
      // Test with detected mode or activeMode override
      const res = testCell(key, val, activeModeCheck(colMode, mode, query));
      if (res.matched) {
        if (!bestResult || res.score > bestResult.score) {
          bestResult = res;
          if (res.score === 100) break; // highest possible
        }
      }
    }

    if (bestResult && bestResult.matched) {
      return {
        row,
        rowIndex: 0,
        sheetName,
        matchedColumn: bestResult.colName,
        matched: true,
        score: bestResult.score,
        matchReason: `[${bestResult.colName}] ${bestResult.reason}`,
        highlightText: bestResult.highlightText,
      };
    }

    return {
      row,
      rowIndex: 0,
      sheetName,
      matched: false,
      score: 0,
      matchReason: 'No match in any column',
    };
  }

  // Case 2: Specific Column Selected
  let targetCol = selectedColumn;
  let cellValue = row[targetCol];

  // If this row doesn't have the selected column (e.g. row from another sheet with different header name)
  if ((cellValue === null || cellValue === undefined || cellValue === '') && mode !== 'fuzzy') {
    // Find corresponding column in this row with matching detected mode
    for (const [k, v] of Object.entries(row)) {
      if (k.startsWith('_')) continue;
      if (detectColumnMode(k) === mode && v !== null && v !== undefined && v !== '') {
        targetCol = k;
        cellValue = v;
        break;
      }
    }
  }

  const result = testCell(targetCol, cellValue, mode);
  return {
    row,
    rowIndex: 0,
    sheetName,
    matchedColumn: targetCol,
    matched: result.matched,
    score: result.score,
    matchReason: targetCol !== selectedColumn ? `[${targetCol}] ${result.reason}` : result.reason,
    highlightText: result.highlightText,
  };
}

function activeModeCheck(colMode: SearchMode, activeMode: SearchMode, query: string): SearchMode {
  // If active mode is explicitly set to Amount, NRC or Phone, prioritize that
  if (colMode === 'amount') return 'amount';
  if (colMode === 'nrc') return 'nrc';
  if (colMode === 'phone') return 'phone';
  if (activeMode === 'amount') return 'amount';
  const digits = extractDigits(query);
  if (digits.length >= 6 && activeMode === 'nrc') return 'nrc';
  if (digits.length >= 6 && activeMode === 'phone') return 'phone';
  return colMode;
}

