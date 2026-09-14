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
