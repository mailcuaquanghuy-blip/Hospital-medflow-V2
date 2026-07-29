
/**
 * Utility to download data as CSV
 * @param data Array of objects containing the data
 * @param filename Name of the file to be downloaded
 * @param headers Array of objects with label (display name) and key (property in data)
 */
export const downloadCSV = (
  data: any[], 
  filename: string, 
  headers: { label: string; key: string }[]
) => {
  const headerLabels = headers.map(h => h.label).join(',');
  
  const csvRows = data.map(row => {
    return headers.map(header => {
      const val = row[header.key] ?? '';
      // Escape double quotes and wrap in quotes
      const escaped = String(val).replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(',');
  });

  const csvContent = [headerLabels, ...csvRows].join('\n');

  // Add BOM (Byte Order Mark) for Excel compatibility with UTF-8
  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Utility to parse CSV content string into a grid (2D array of strings)
 * @param text The raw CSV text content
 */
export const parseCSV = (text: string): string[][] => {
  const lines = text.split(/\r?\n/);
  return lines
    .map(line => {
      if (!line.trim()) return [];
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      // Remove enclosing quotes if any and handle escaped quotes
      return result.map(val => {
        let clean = val;
        if (clean.startsWith('"') && clean.endsWith('"')) {
          clean = clean.slice(1, -1);
        }
        return clean.replace(/""/g, '"');
      });
    })
    .filter(row => row.length > 0);
};

