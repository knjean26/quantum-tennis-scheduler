import { google } from "googleapis";
import path from "path";

const SPREADSHEET_ID = "1By9tZFJXji9SB4OGb8abJHEMTZM35l9ezDSVLZyaLdU";
const SHEET_NAME = "Monthly Report";

function getAuth() {
  // In production use GOOGLE_CREDENTIALS env var; locally fall back to the JSON file
  if (process.env.GOOGLE_CREDENTIALS) {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    return new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
  }
  return new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), "quantum-scheduler-25e7cefa2284.json"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

export async function getBookingRows(): Promise<string[][]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!A1:AU2000`,
  });
  const all = (res.data.values ?? []) as string[][];
  return all.slice(1); // skip header row
}
