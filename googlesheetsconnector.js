const { google } = require('googleapis')
const crypto = require('crypto')
const DEFAULT_SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']

/**
 * Authenticates with Google using a service account.
 * @param {Object} params
 * @param {string} params.clientEmail - Service account client email.
 * @param {string} params.privateKey - Service account private key.
 * @param {string[]} [params.scopes] - OAuth scopes.
 * @returns {Promise<import('google-auth-library').JWT>} Authorized JWT client.
 */
async function authenticateGoogle({ clientEmail, privateKey, scopes = DEFAULT_SCOPES }) {
  if (!clientEmail || !privateKey) {
    throw new Error('Missing Google service account credentials: clientEmail and privateKey are required.')
  }
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey.replace(/\\n/g, '\n'),
    scopes,
  })
  await auth.authorize()
  return auth
}

/**
 * Creates a Sheets API client using an authorized Google client.
 * @param {import('google-auth-library').JWT} authClient - Authorized JWT client.
 * @returns {import('googleapis').sheets_v4.Sheets} Sheets API client.
 */
function connectToSheet(authClient) {
  return google.sheets({ version: 'v4', auth: authClient })
}

/**
 * Fetches raw sheet data as rows.
 * @param {import('googleapis').sheets_v4.Sheets} sheets - Sheets API client.
 * @param {string} spreadsheetId - ID of the spreadsheet.
 * @param {string} range - A1 notation of the range to fetch.
 * @returns {Promise<string[][]>} Array of rows.
 */
async function fetchSheetData(sheets, spreadsheetId, range) {
  if (!sheets || !spreadsheetId || !range) {
    throw new Error('fetchSheetData requires sheets client, spreadsheetId, and range.')
  }
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    majorDimension: 'ROWS',
  })
  return response.data.values || []
}

/**
 * Transforms an array of rows into an array of objects using the header row as keys.
 * @param {string[][]} rows - Raw rows from the sheet.
 * @returns {Object[]} Array of row objects.
 */
function transformRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return []
  }
  const [headerRow, ...dataRows] = rows
  return dataRows.map(row => {
    const obj = {}
    headerRow.forEach((col, idx) => {
      obj[col] = row[idx] !== undefined ? row[idx] : ''
    })
    return obj
  })
}

/**
 * Polls a Google Sheet at a specified interval and invokes a callback on updates.
 * @param {import('googleapis').sheets_v4.Sheets} sheets - Sheets API client.
 * @param {string} spreadsheetId - ID of the spreadsheet.
 * @param {string} range - A1 notation of the range to poll.
 * @param {number} intervalMs - Polling interval in milliseconds (must be > 0).
 * @param {(data: Object[]) => void} onUpdate - Callback invoked with transformed rows on change.
 * @returns {{ stop: () => void }} Controller with stop method.
 */
function pollSheetUpdates(sheets, spreadsheetId, range, intervalMs, onUpdate) {
  if (typeof onUpdate !== 'function') {
    throw new Error('pollSheetUpdates requires an onUpdate callback function.')
  }
  if (typeof intervalMs !== 'number' || intervalMs <= 0) {
    throw new Error('intervalMs must be a positive number.')
  }

  let previousHash = ''
  let stopped = false

  const computeHash = data => {
    return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex')
  }

  async function check() {
    try {
      const rows = await fetchSheetData(sheets, spreadsheetId, range)
      const hash = computeHash(rows)
      if (hash !== previousHash) {
        previousHash = hash
        const transformed = transformRows(rows)
        onUpdate(transformed)
      }
    } catch (err) {
      console.error('Error polling Google Sheet:', err)
    }
  }

  // initial fetch
  check()

  const intervalId = setInterval(() => {
    if (stopped) return
    check()
  }, intervalMs)

  return {
    stop: () => {
      stopped = true
      clearInterval(intervalId)
    },
  }
}

export {
  authenticateGoogle,
  connectToSheet,
  fetchSheetData,
  transformRows,
  pollSheetUpdates,
}