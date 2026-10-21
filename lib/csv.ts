// CSV for the /admin exports. Strings that a spreadsheet would read as a formula get a
// leading quote (CSV injection); numbers and booleans are written as they are.

const FORMULA_START = /^\s*[=+\-@]|^[\t\r]/;

function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = Array.isArray(value) ? value.join('; ') : typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (typeof value === 'string' || Array.isArray(value) || typeof value === 'object') {
    if (FORMULA_START.test(text)) text = `'${text}`;
  }
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const lines = [columns.map(cell).join(','), ...rows.map((row) => columns.map((c) => cell(row[c])).join(','))];
  // BOM so Excel reads UTF-8 accents correctly.
  return '﻿' + lines.join('\r\n') + '\r\n';
}
