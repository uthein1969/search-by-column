/**
 * Utilities for Myanmar numbers and digit extraction
 */

// Myanmar numerals mapping to standard digits
const MYANMAR_TO_ENGLISH_DIGITS: Record<string, string> = {
  '၀': '0',
  '၁': '1',
  '၂': '2',
  '၃': '3',
  '၄': '4',
  '၅': '5',
  '၆': '6',
  '၇': '7',
  '၈': '8',
  '၉': '9',
};

const ENGLISH_TO_MYANMAR_DIGITS: Record<string, string> = {
  '0': '၀',
  '1': '၁',
  '2': '၂',
  '3': '၃',
  '4': '၄',
  '5': '၅',
  '6': '၆',
  '7': '၇',
  '8': '၈',
  '9': '၉',
};

/**
 * Converts any Myanmar numerals in the text to standard Western digits (0-9)
 */
export function convertMyanmarToEnglishDigits(text: string): string {
  if (!text) return '';
  return text.replace(/[၀-၉]/g, (char) => MYANMAR_TO_ENGLISH_DIGITS[char] || char);
}

/**
 * Converts Western digits to Myanmar numerals
 */
export function convertEnglishToMyanmarDigits(text: string | number): string {
  if (text === null || text === undefined) return '';
  return String(text).replace(/[0-9]/g, (char) => ENGLISH_TO_MYANMAR_DIGITS[char] || char);
}

/**
 * Extracts all digits from text after converting Myanmar numerals
 */
export function extractDigits(text: any): string {
  if (text === null || text === undefined) return '';
  const str = convertMyanmarToEnglishDigits(String(text));
  return str.replace(/\D/g, '');
}

/**
 * Extracts the last N digits from text
 */
export function extractLastDigits(text: any, count: number = 6): string {
  const digits = extractDigits(text);
  if (digits.length < count) {
    return digits;
  }
  return digits.slice(-count);
}

/**
 * Normalizes phone number: extracts digits, handles Myanmar country code (+959 or 959 or 09)
 */
export function normalizePhoneNumber(text: any): string {
  const digits = extractDigits(text);
  if (!digits) return '';

  // If starts with 959 (Myanmar country code without +), strip 95 or keep standard format
  if (digits.startsWith('959') && digits.length >= 10) {
    return '09' + digits.slice(3);
  }
  if (digits.startsWith('9509') && digits.length >= 11) {
    return '09' + digits.slice(4);
  }
  return digits;
}

/**
 * Parses numeric amount from string or number, removing commas, currency symbols (Ks, MMK, $, etc.),
 * converting Myanmar numerals, and handling decimals.
 * Rejects non-numeric strings (like dates, text with words, IDs with letters).
 */
export function parseAmount(val: any): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    return isNaN(val) ? null : val;
  }
  const str = convertMyanmarToEnglishDigits(String(val)).trim();
  if (!str) return null;

  let s = str;

  // Check negative in parentheses like (1,500.00) or (500)
  let isNegative = false;
  const parenMatch = s.match(/^\((.*)\)$/);
  if (parenMatch) {
    isNegative = true;
    s = parenMatch[1].trim();
  }

  // Remove common currency symbols/words at beginning or end
  s = s
    .replace(/^(?:ks|mmk|kyat|usd|\$|€|£|ကျပ်|ပြား)\s*/i, '')
    .replace(/\s*(?:ks|mmk|kyat|usd|\$|€|£|ကျပ်|ပြား)$/i, '')
    .trim();

  // If there are still letters, words, colons, or multiple hyphens (like dates 2026-09-15), it is NOT an amount
  // Allow only digits, comma, dot, and optional leading minus/plus
  const withoutCommas = s.replace(/,/g, '').trim();
  if (!/^[+-]?\d*(?:\.\d+)?$/.test(withoutCommas) || withoutCommas === '' || withoutCommas === '+' || withoutCommas === '-') {
    return null;
  }

  const num = parseFloat(withoutCommas);
  if (isNaN(num)) return null;
  return isNegative ? -Math.abs(num) : num;
}

export type ComparisonOp = '>' | '>=' | '<' | '<=' | '=' | '!=' | 'range';

export interface ParsedAmountQuery {
  isValid: boolean;
  operator: ComparisonOp;
  value: number;
  value2?: number; // for range
  rawInput: string;
}

/**
 * Parses user query for Amount comparison:
 * - Direct operators: "> 10000", "< 50000", ">= 3000", "<= 300000", "= 300000", "!= 0", "<> 0"
 * - Range: "1000 - 50000", "1000 to 50000", "1000..50000"
 * - Plain number: "300000" or "300,000" (defaults to '=' exact match)
 */
export function parseAmountQuery(query: string): ParsedAmountQuery {
  const raw = query.trim();
  if (!raw) {
    return { isValid: false, operator: '=', value: 0, rawInput: raw };
  }

  const normalized = convertMyanmarToEnglishDigits(raw);

  // 1. Check for Range: e.g. "1000 - 50000", "1000 to 50000", "1000..50000"
  const rangeMatch = normalized.match(/^([0-9.,]+)\s*(?:-|to|\.\.)\s*([0-9.,]+)$/i);
  if (rangeMatch) {
    const v1 = parseAmount(rangeMatch[1]);
    const v2 = parseAmount(rangeMatch[2]);
    if (v1 !== null && v2 !== null) {
      return {
        isValid: true,
        operator: 'range',
        value: Math.min(v1, v2),
        value2: Math.max(v1, v2),
        rawInput: raw,
      };
    }
  }

  // 2. Check for Prefix Operators
  let op: ComparisonOp = '=';
  let numStr = normalized;

  if (normalized.startsWith('>=') || normalized.startsWith('=>')) {
    op = '>=';
    numStr = normalized.slice(2);
  } else if (normalized.startsWith('<=') || normalized.startsWith('=<')) {
    op = '<=';
    numStr = normalized.slice(2);
  } else if (normalized.startsWith('!=') || normalized.startsWith('<>')) {
    op = '!=';
    numStr = normalized.slice(2);
  } else if (normalized.startsWith('>')) {
    op = '>';
    numStr = normalized.slice(1);
  } else if (normalized.startsWith('<')) {
    op = '<';
    numStr = normalized.slice(1);
  } else if (normalized.startsWith('==')) {
    op = '=';
    numStr = normalized.slice(2);
  } else if (normalized.startsWith('=')) {
    op = '=';
    numStr = normalized.slice(1);
  }

  const val = parseAmount(numStr);
  if (val === null) {
    return { isValid: false, operator: op, value: 0, rawInput: raw };
  }

  return {
    isValid: true,
    operator: op,
    value: val,
    rawInput: raw,
  };
}

/**
 * Identifies columns that represent financial amounts, fees, balances or monetary values.
 * Excludes currency codes (_CUR, CURRENCY, etc.), dates, IDs, reference numbers, etc.
 */
export function isAmountColumn(colName: string): boolean {
  if (!colName) return false;
  const lower = colName.toLowerCase().trim();

  // 0. Definite CURRENCY CODE exclusion:
  // Columns containing '_cur', 'cur_', currency codes/names (e.g. OPER_AMOUNT_CUR, STTL_AMOUNT_CUR, CURRENCY)
  // are currency identifiers (e.g. 104 = MMK, 840 = USD) and must NEVER be totaled or formatted as monetary amount.
  if (
    lower.includes('_cur') ||
    lower.includes('cur_') ||
    lower.endsWith('_cur') ||
    lower.endsWith('-cur') ||
    lower.endsWith('.cur') ||
    lower.includes('_curr') ||
    lower.includes('curr_') ||
    lower.includes('currency') ||
    lower.includes('_ccy') ||
    lower.includes('ccy_') ||
    lower === 'cur' ||
    lower === 'curr' ||
    lower === 'ccy' ||
    /\bcur\b/i.test(colName) ||
    /\bcurr\b/i.test(colName) ||
    /\bccy\b/i.test(colName) ||
    /\bcurrency\b/i.test(colName)
  ) {
    return false;
  }

  // 1. Definite NON-amount column patterns:
  // Dates, Times, Timestamps
  if (
    lower.includes('date') ||
    lower.includes('time') ||
    lower.includes('timestamp') ||
    lower.includes('year') ||
    lower.includes('month') ||
    lower.includes('day')
  ) {
    return false;
  }

  // Identifiers, References, Codes, Party, Names, Types, Statuses, Accounts, Phones, NRC
  if (
    lower.includes('id') ||
    lower.includes('ref') ||
    lower.includes('party') ||
    lower.includes('account') ||
    lower.includes('phone') ||
    lower.includes('mobile') ||
    lower.includes('tel') ||
    lower.includes('nrc') ||
    lower.includes('card') ||
    lower.includes('pan') ||
    lower.includes('terminal') ||
    lower.includes('auth') ||
    lower.includes('trace') ||
    lower.includes('rrn') ||
    lower.includes('stan') ||
    lower.includes('seq') ||
    lower.includes('code') ||
    lower.includes('token') ||
    lower.includes('batch') ||
    lower.includes('type') ||
    lower.includes('mode') ||
    lower.includes('status') ||
    lower.includes('channel') ||
    lower.includes('name') ||
    lower.includes('merchant') ||
    lower.includes('customer') ||
    lower.includes('user') ||
    lower.includes('agent') ||
    lower.includes('branch') ||
    lower.includes('desc') ||
    lower.includes('description') ||
    lower.includes('remark') ||
    lower.includes('note')
  ) {
    // Allow ONLY if the column name EXPLICITLY specifies an amount keyword
    // (e.g. 'receiver amount', 'transaction amount', 'dps fee', 'oper_request_amount_val', 'sttl_amount_val')
    if (
      lower.includes('amount') ||
      lower.includes('amt') ||
      lower.includes('fee') ||
      lower.includes('expense') ||
      lower.endsWith('_val')
    ) {
      return true;
    }
    return false;
  }

  // 2. Definite AMOUNT keywords
  if (
    lower.includes('amount') ||
    lower.includes('amt') ||
    lower.includes('fee') ||
    lower.includes('fees') ||
    lower.includes('expense') ||
    lower.includes('expenses') ||
    lower.includes('mdr') ||
    lower.includes('price') ||
    lower.includes('cost') ||
    lower.includes('charge') ||
    lower.includes('balance') ||
    lower.includes('salary') ||
    lower.includes('commission') ||
    lower.includes('bonus') ||
    lower.includes('refund') ||
    lower.startsWith('add_ampr') ||
    lower.includes('ampr') ||
    lower.endsWith('_val') ||
    lower.includes('ပမာဏ') ||
    lower.includes('ငွေပမာဏ') ||
    lower.includes('ကျသင့်ငွေ') ||
    lower.includes('တန်ဖိုး') ||
    lower.includes('ကြေး')
  ) {
    return true;
  }

  // Check if column is strictly 'total' or 'sum' or 'net' or 'gross'
  if (lower === 'total' || lower === 'sum' || lower === 'net' || lower === 'gross') {
    return true;
  }

  return false;
}

/**
 * Formats an amount value with commas and decimals, optionally applying minor unit division (/100)
 */
export function formatAmountValue(val: any, divideBy100: boolean = false): string {
  if (val === null || val === undefined || String(val).trim() === '') return '';
  const num = parseAmount(val);
  if (num === null || isNaN(num)) return String(val);

  const effectiveNum = divideBy100 ? num / 100 : num;
  const hasDecimals = !Number.isInteger(effectiveNum);

  return effectiveNum.toLocaleString('en-US', {
    minimumFractionDigits: divideBy100 || hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
}
