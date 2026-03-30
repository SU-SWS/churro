/**
 * Triggers a CSV file download in the browser.
 *
 * Values are RFC 4180 escaped (CRLF line endings) and neutralized against CSV/spreadsheet
 * formula injection (OWASP: cells starting with =, +, -, @, or tab).
 */
export function downloadCsv(filename: string, rows: Array<Array<string | number>>): void {
  const escape = (val: string | number): string => {
    let s = String(val);
    // Neutralize CSV/spreadsheet formula injection (OWASP).
    // Match after any leading whitespace so " =1+1" is also caught.
    if (/^\s*[=+\-@\t]/.test(s)) s = `'${s}`;
    return /[,"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map(row => row.map(escape).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revocation so the browser has time to initiate the download
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
