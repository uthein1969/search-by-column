import { ExcelWorkbookData, SheetDetail, ColumnInfo } from '../types';
import { detectColumnMode } from './searchMatcher';

/**
 * Helper to get text content of tag regardless of namespace
 */
function getDirectTagText(parent: Element, tagName: string): string {
  const lower = tagName.toLowerCase();
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child.localName.toLowerCase() === lower) {
      return child.textContent?.trim() || '';
    }
  }
  const elems = parent.getElementsByTagName(tagName);
  if (elems && elems.length > 0) {
    return elems[0].textContent?.trim() || '';
  }
  return '';
}

/**
 * Format currency amounts (e.g. ISO 4217 minor unit / 100 for MMK, USD, etc.)
 */
function formatAmountMinorUnit(rawVal: string): string {
  if (!rawVal) return '0.00';
  const num = parseFloat(rawVal);
  if (isNaN(num)) return rawVal;
  const val = num / 100;
  return val.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateDisplay(rawDate: string): string {
  if (!rawDate) return '';
  return rawDate.replace('T', ' ');
}

export const STANDARD_SETTLEMENT_COLUMNS = [
  'oper_id',
  'oper_type',
  'msg_type',
  'original_id',
  'oper_date',
  'host_date',
  'oper_count',
  'originator_refnum',
  'status',
  'is_reversal',
  'merchant_number',
  'mcc',
  'merchant_name',
  'merchant_region',
  'terminal_number',
  'sttl_date',
  'match_status',
  'oper_amount_val',
  'oper_amount_cur',
  'oper_request_amount_val',
  'oper_request_amount_cur',
  'oper_cashback_amount_val',
  'oper_cashback_amount_cur',
  'sttl_amount_val',
  'sttl_amount_cur',
  'interchange_fee_val',
  'interchange_fee_cur',
  'issuer_inst',
  'issuer_card',
  'acquirer_inst',
  'ADD_AMPR0001',
  'ADD_AMPR0003',
  'ADD_AMPR0004',
  'ADD_AMPR0009',
  'ADD_AMPR0025',
  'FLEX_CST_OPER_UNIQUE_TRN_REF',
  'FLEX_CST_OPER_TOKEN_NUMBER',
  'FLEX_CST_OPER_IS_CREDIT_OPERATION',
] as const;

/**
 * Parses BPC Clearing XML / Merchant Settlement XML specifically
 * Preserves all 38 exact columns from standard BPC Clearing format.
 */
function parseSettlementXml(xmlDoc: Document, fileName: string): ExcelWorkbookData | null {
  // Find all <operation> tags
  const operationNodes = xmlDoc.getElementsByTagName('operation');
  if (!operationNodes || operationNodes.length === 0) {
    return null;
  }

  // File header info
  const root = xmlDoc.documentElement;
  const fileId = getDirectTagText(root, 'file_id');
  const fileType = getDirectTagText(root, 'file_type');
  const startDate = getDirectTagText(root, 'start_date');
  const endDate = getDirectTagText(root, 'end_date');
  const instId = getDirectTagText(root, 'inst_id');
  const fileDate = getDirectTagText(root, 'file_date');

  const operationsList: Record<string, any>[] = [];
  let totalOperAmountNum = 0;
  let totalFeeNum = 0;

  // Track any extra dynamic columns across all operations so no data is ever missed
  const extraColumnsSet = new Set<string>();

  for (let i = 0; i < operationNodes.length; i++) {
    const op = operationNodes[i];

    const operId = getDirectTagText(op, 'oper_id');
    const operType = getDirectTagText(op, 'oper_type');
    const msgType = getDirectTagText(op, 'msg_type');
    const originalId = getDirectTagText(op, 'original_id') || getDirectTagText(op, 'orig_id') || '';
    const operDate = getDirectTagText(op, 'oper_date');
    const hostDate = getDirectTagText(op, 'host_date');
    const operCount = getDirectTagText(op, 'oper_count') || '1';
    const originatorRefnum = getDirectTagText(op, 'originator_refnum');
    const status = getDirectTagText(op, 'status');
    const isReversal = getDirectTagText(op, 'is_reversal') || '0';
    const merchantNumber = getDirectTagText(op, 'merchant_number');
    const mcc = getDirectTagText(op, 'mcc');
    const merchantName = getDirectTagText(op, 'merchant_name');
    const merchantRegion = getDirectTagText(op, 'merchant_region') || '';
    const terminalNumber = getDirectTagText(op, 'terminal_number');
    const sttlDate = getDirectTagText(op, 'sttl_date');
    const matchStatus = getDirectTagText(op, 'match_status');

    // Amount elements
    const operAmountEl = op.getElementsByTagName('oper_amount')[0];
    const operAmountVal = operAmountEl ? getDirectTagText(operAmountEl, 'amount_value') : '';
    const operAmountCur = operAmountEl ? getDirectTagText(operAmountEl, 'currency') : '104';

    const reqAmountEl = op.getElementsByTagName('oper_request_amount')[0];
    const operReqAmountVal = reqAmountEl ? getDirectTagText(reqAmountEl, 'amount_value') : operAmountVal;
    const operReqAmountCur = reqAmountEl ? getDirectTagText(reqAmountEl, 'currency') : operAmountCur;

    const cashbackAmountEl = op.getElementsByTagName('oper_cashback_amount')[0];
    const operCashbackAmountVal = cashbackAmountEl ? getDirectTagText(cashbackAmountEl, 'amount_value') : '0';
    const operCashbackAmountCur = cashbackAmountEl ? getDirectTagText(cashbackAmountEl, 'currency') : operAmountCur;

    const sttlAmountEl = op.getElementsByTagName('sttl_amount')[0];
    const sttlAmountVal = sttlAmountEl ? getDirectTagText(sttlAmountEl, 'amount_value') : operAmountVal;
    const sttlAmountCur = sttlAmountEl ? getDirectTagText(sttlAmountEl, 'currency') : operAmountCur;

    const feeEl = op.getElementsByTagName('interchange_fee')[0];
    const feeVal = feeEl ? getDirectTagText(feeEl, 'amount_value') : '0';
    const feeCur = feeEl ? getDirectTagText(feeEl, 'currency') : operAmountCur;

    if (operAmountVal) {
      totalOperAmountNum += parseFloat(operAmountVal) / 100;
    }
    if (feeVal) {
      totalFeeNum += parseFloat(feeVal) / 100;
    }

    // Issuer & Acquirer
    const issuerEl = op.getElementsByTagName('issuer')[0];
    const issuerInst = issuerEl ? getDirectTagText(issuerEl, 'inst_id') : '';
    const issuerCard = issuerEl ? getDirectTagText(issuerEl, 'card_number') : '';

    const acquirerEl = op.getElementsByTagName('acquirer')[0];
    const acquirerInst = acquirerEl ? getDirectTagText(acquirerEl, 'inst_id') : '';

    // Additional Amounts map (e.g. AMPR0001, AMPR0003, AMPR0004, AMPR0009, AMPR0025)
    const addAmountsMap: Record<string, string> = {};
    const addAmountNodes = op.getElementsByTagName('additional_amount');
    for (let a = 0; a < addAmountNodes.length; a++) {
      const aNode = addAmountNodes[a];
      const aType = getDirectTagText(aNode, 'amount_type');
      const aVal = getDirectTagText(aNode, 'amount_value');
      if (aType) {
        addAmountsMap[aType] = aVal;
      }
    }

    // Flexible Data map (e.g. CST_OPER_UNIQUE_TRN_REF, CST_OPER_TOKEN_NUMBER, CST_OPER_IS_CREDIT_OPERATION)
    const flexMap: Record<string, string> = {};
    const flexNodes = op.getElementsByTagName('flexible_data');
    for (let f = 0; f < flexNodes.length; f++) {
      const fNode = flexNodes[f];
      const fName = getDirectTagText(fNode, 'field_name');
      const fVal = getDirectTagText(fNode, 'field_value');
      if (fName) {
        flexMap[fName] = fVal;
      }
    }

    // Build row matching exactly the 38 original columns
    const rowObj: Record<string, any> = {
      oper_id: operId,
      oper_type: operType,
      msg_type: msgType,
      original_id: originalId,
      oper_date: operDate,
      host_date: hostDate,
      oper_count: operCount,
      originator_refnum: originatorRefnum,
      status: status,
      is_reversal: isReversal,
      merchant_number: merchantNumber,
      mcc: mcc,
      merchant_name: merchantName,
      merchant_region: merchantRegion,
      terminal_number: terminalNumber,
      sttl_date: sttlDate,
      match_status: matchStatus,
      oper_amount_val: operAmountVal,
      oper_amount_cur: operAmountCur,
      oper_request_amount_val: operReqAmountVal,
      oper_request_amount_cur: operReqAmountCur,
      oper_cashback_amount_val: operCashbackAmountVal,
      oper_cashback_amount_cur: operCashbackAmountCur,
      sttl_amount_val: sttlAmountVal,
      sttl_amount_cur: sttlAmountCur,
      interchange_fee_val: feeVal,
      interchange_fee_cur: feeCur,
      issuer_inst: issuerInst,
      issuer_card: issuerCard,
      acquirer_inst: acquirerInst,
      ADD_AMPR0001: addAmountsMap['AMPR0001'] ?? '',
      ADD_AMPR0003: addAmountsMap['AMPR0003'] ?? '',
      ADD_AMPR0004: addAmountsMap['AMPR0004'] ?? '',
      ADD_AMPR0009: addAmountsMap['AMPR0009'] ?? '',
      ADD_AMPR0025: addAmountsMap['AMPR0025'] ?? '',
      FLEX_CST_OPER_UNIQUE_TRN_REF: flexMap['CST_OPER_UNIQUE_TRN_REF'] ?? '',
      FLEX_CST_OPER_TOKEN_NUMBER: flexMap['CST_OPER_TOKEN_NUMBER'] ?? '',
      FLEX_CST_OPER_IS_CREDIT_OPERATION: flexMap['CST_OPER_IS_CREDIT_OPERATION'] ?? '',
    };

    // Check if there are any other AMPR or FLEX keys not in the standard 38
    for (const [aType, aVal] of Object.entries(addAmountsMap)) {
      const colName = `ADD_${aType}`;
      if (!(colName in rowObj)) {
        rowObj[colName] = aVal;
        extraColumnsSet.add(colName);
      }
    }
    for (const [fName, fVal] of Object.entries(flexMap)) {
      const colName = `FLEX_${fName}`;
      if (!(colName in rowObj)) {
        rowObj[colName] = fVal;
        extraColumnsSet.add(colName);
      }
    }

    operationsList.push(rowObj);
  }

  // Final columns: standard 38 columns first, followed by any additional dynamic columns
  const opColumns = [...STANDARD_SETTLEMENT_COLUMNS, ...Array.from(extraColumnsSet)];

  // Ensure every row has all columns defined
  operationsList.forEach((r) => {
    opColumns.forEach((c) => {
      if (r[c] === undefined) {
        r[c] = '';
      }
    });
  });

  // Generate Summary Sheet rows
  const summaryRows: Record<string, any>[] = [
    { 'Parameter': 'File Name', 'Value': fileName },
    { 'Parameter': 'File ID', 'Value': fileId || 'N/A' },
    { 'Parameter': 'File Type', 'Value': fileType || 'FLTP1710' },
    { 'Parameter': 'Institution ID', 'Value': instId || '4203' },
    { 'Parameter': 'File Date', 'Value': fileDate || 'N/A' },
    { 'Parameter': 'Start Date', 'Value': startDate || 'N/A' },
    { 'Parameter': 'End Date', 'Value': endDate || 'N/A' },
    { 'Parameter': 'Total Operations Count', 'Value': operationsList.length.toLocaleString() },
    { 'Parameter': 'Total Columns Extracted', 'Value': `${opColumns.length} columns (Original 38 + ${extraColumnsSet.size} extra)` },
    {
      'Parameter': 'Total Transaction Amount (MMK)',
      'Value': totalOperAmountNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    },
    {
      'Parameter': 'Total Interchange Fee (MMK)',
      'Value': totalFeeNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    },
  ];

  const opColumnInfos: ColumnInfo[] = opColumns.map((col) => ({
    name: col,
    detectedMode: detectColumnMode(col),
    sampleValues: operationsList.slice(0, 3).map((r) => String(r[col] || '')),
  }));

  const summaryColumns = ['Parameter', 'Value'];
  const summaryColumnInfos: ColumnInfo[] = summaryColumns.map((col) => ({
    name: col,
    detectedMode: 'fuzzy',
    sampleValues: summaryRows.slice(0, 3).map((r) => String(r[col] || '')),
  }));

  const sheets: Record<string, SheetDetail> = {
    'Settlement_Operations': {
      name: 'Settlement_Operations',
      columns: opColumns,
      columnInfos: opColumnInfos,
      rows: operationsList,
    },
    'File_Summary': {
      name: 'File_Summary',
      columns: summaryColumns,
      columnInfos: summaryColumnInfos,
      rows: summaryRows,
    },
  };

  return {
    fileName,
    sheetNames: ['Settlement_Operations', 'File_Summary'],
    activeSheetName: 'Settlement_Operations',
    sheets,
  };
}

/**
 * Generic XML Parser for any XML file with repeating tags
 */
function parseGenericXml(xmlDoc: Document, fileName: string): ExcelWorkbookData {
  const root = xmlDoc.documentElement;

  // Find candidate repeating child tag names
  const tagCounts: Record<string, number> = {};
  for (let i = 0; i < root.children.length; i++) {
    const tagName = root.children[i].localName;
    tagCounts[tagName] = (tagCounts[tagName] || 0) + 1;
  }

  // Find the tag name that repeats the most
  let maxTag = '';
  let maxCount = 0;
  for (const [tag, count] of Object.entries(tagCounts)) {
    if (count > maxCount) {
      maxCount = count;
      maxTag = tag;
    }
  }

  const rows: Record<string, any>[] = [];
  const targetElements: Element[] = [];

  if (maxCount > 1) {
    for (let i = 0; i < root.children.length; i++) {
      if (root.children[i].localName === maxTag) {
        targetElements.push(root.children[i]);
      }
    }
  } else if (root.children.length > 0) {
    // If only 1 child collection (e.g. <records><row>...</records>)
    const firstChild = root.children[0];
    if (firstChild.children.length > 0) {
      for (let i = 0; i < firstChild.children.length; i++) {
        targetElements.push(firstChild.children[i]);
      }
    } else {
      targetElements.push(firstChild);
    }
  }

  // Helper to recursively flatten an element
  const flattenElement = (el: Element, prefix = ''): Record<string, any> => {
    const res: Record<string, any> = {};

    // Attributes
    if (el.attributes) {
      for (let a = 0; a < el.attributes.length; a++) {
        const attr = el.attributes[a];
        res[`${prefix}@${attr.name}`] = attr.value;
      }
    }

    if (el.children.length === 0) {
      res[prefix ? prefix.replace(/\.$/, '') : el.localName] = el.textContent?.trim() || '';
      return res;
    }

    for (let i = 0; i < el.children.length; i++) {
      const child = el.children[i];
      const childKey = prefix ? `${prefix}.${child.localName}` : child.localName;

      if (child.children.length === 0 && (!child.attributes || child.attributes.length === 0)) {
        res[childKey] = child.textContent?.trim() || '';
      } else {
        const nested = flattenElement(child, childKey);
        Object.assign(res, nested);
      }
    }

    return res;
  };

  for (const elem of targetElements) {
    rows.push(flattenElement(elem));
  }

  // Collect all unique columns
  const colSet = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      colSet.add(k);
    }
  }
  const columns = Array.from(colSet);

  const columnInfos: ColumnInfo[] = columns.map((col) => ({
    name: col,
    detectedMode: detectColumnMode(col),
    sampleValues: rows.slice(0, 3).map((r) => String(r[col] || '')),
  }));

  const sheetName = maxTag ? `${maxTag.charAt(0).toUpperCase() + maxTag.slice(1)}s` : 'Data';

  return {
    fileName,
    sheetNames: [sheetName],
    activeSheetName: sheetName,
    sheets: {
      [sheetName]: {
        name: sheetName,
        columns,
        columnInfos,
        rows,
      },
    },
  };
}

/**
 * Main entrance for XML parsing
 */
export function parseXmlStringToWorkbook(xmlString: string, fileName: string): ExcelWorkbookData {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  // Check for XML parse errors
  const parseError = xmlDoc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`Invalid XML format: ${parseError.textContent?.slice(0, 150) || 'Syntax error'}`);
  }

  // 1. Try BPC Clearing / Settlement XML Parser
  const settlementWb = parseSettlementXml(xmlDoc, fileName);
  if (settlementWb) {
    return settlementWb;
  }

  // 2. Generic XML Parser
  return parseGenericXml(xmlDoc, fileName);
}
