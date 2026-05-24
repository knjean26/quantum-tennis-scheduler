import { google } from "googleapis";
import path from "path";

const SPREADSHEET_ID = "1By9tZFJXji9SB4OGb8abJHEMTZM35l9ezDSVLZyaLdU";
const SHEET_NAME = "Monthly Report";

function getAuth(write = false) {
  const scopes = write
    ? ["https://www.googleapis.com/auth/spreadsheets"]
    : ["https://www.googleapis.com/auth/spreadsheets.readonly"];
  if (process.env.GOOGLE_CREDENTIALS) {
    return new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes,
    });
  }
  return new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), "quantum-scheduler-25e7cefa2284.json"),
    scopes,
  });
}

function colToA1(index: number): string {
  const n = index + 1;
  if (n <= 26) return String.fromCharCode(64 + n);
  return (
    String.fromCharCode(64 + Math.floor((n - 1) / 26)) +
    String.fromCharCode(65 + ((n - 1) % 26))
  );
}

export async function getBookingRows(): Promise<string[][]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!A1:BH2000`,
  });
  const all = (res.data.values ?? []) as string[][];
  return all.slice(1);
}

export async function getAdminRows(): Promise<{ rowIndex: number; values: string[] }[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!A1:BH2000`,
  });
  const all = (res.data.values ?? []) as string[][];
  return all.slice(1).map((values, i) => ({ rowIndex: i + 2, values }));
}

export async function appendBookingRow(values: string[]): Promise<number> {
  const auth = getAuth(true);
  const sheets = google.sheets({ version: "v4", auth });

  // Find the first empty row by scanning column A (skip header row 1)
  const colARes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!A:A`,
  });
  const colA = (colARes.data.values ?? []) as string[][];
  let rowIndex = colA.length + 1; // default: first row after all data
  for (let i = 1; i < colA.length; i++) {
    if (!colA[i]?.[0]?.trim()) {
      rowIndex = i + 1; // i is 0-based; sheet rows are 1-based
      break;
    }
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!A${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });

  return rowIndex;
}

export async function updateBookingColumns(
  rowIndex: number,
  fieldMap: Record<number, string>
): Promise<void> {
  const auth = getAuth(true);
  const sheets = google.sheets({ version: "v4", auth });
  const data = Object.entries(fieldMap).map(([colStr, value]) => ({
    range: `'${SHEET_NAME}'!${colToA1(parseInt(colStr))}${rowIndex}`,
    values: [[value]],
  }));
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });
}

export async function deleteBookingRow(rowIndex: number): Promise<void> {
  const auth = getAuth(true);
  const sheets = google.sheets({ version: "v4", auth });
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheetId =
    meta.data.sheets?.find((s) => s.properties?.title === SHEET_NAME)
      ?.properties?.sheetId ?? 0;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: { sheetId, dimension: "ROWS", startIndex: rowIndex - 1, endIndex: rowIndex },
          },
        },
      ],
    },
  });
}

export async function getNamedSheetRows(sheetName: string): Promise<string[][]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A1:Z200`,
  });
  return (res.data.values ?? []) as string[][];
}

export async function updateNamedSheetRows(sheetName: string, rows: string[][]): Promise<void> {
  const auth = getAuth(true);
  const sheets = google.sheets({ version: "v4", auth });
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A1:Z200`,
  });
  if (rows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows },
    });
  }
}
