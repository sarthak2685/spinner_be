export function toCsv(headers: string[], rows: Record<string, unknown>[]) {
  const line = (values: unknown[]) => values.map(cell).join(',');
  return [line(headers), ...rows.map((row) => line(headers.map((header) => row[header])))].join('\r\n');
}

function cell(value: unknown) {
  if (value == null) return '';
  const text = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}
