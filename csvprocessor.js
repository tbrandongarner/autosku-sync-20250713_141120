const { parse } = require('csv-parse')

async function parseCSV(stream) {
  return new Promise((resolve, reject) => {
    const records = []
    const parser = parse({ columns: true, skip_empty_lines: true, trim: false })
    stream.on('error', err => reject(err))
    stream.pipe(parser)
      .on('data', row => {
        if (validateRow(row)) {
          records.push(normalizeData(row))
        }
      })
      .on('error', err => reject(err))
      .on('end', () => resolve(records))
  })
}

function validateRow(row) {
  if (!row || typeof row !== 'object') return false
  for (const key of Object.keys(row)) {
    const value = row[key]
    if (value === null || value === undefined) return false
    if (typeof value === 'string' && value.trim() === '') return false
  }
  return true
}

function normalizeData(row) {
  const normalized = {}
  for (const [key, raw] of Object.entries(row)) {
    let value = raw
    if (typeof value === 'string') {
      value = value.trim()
      const lower = value.toLowerCase()
      if (lower === 'true' || lower === 'false') {
        value = lower === 'true'
      } else if (!isNaN(value) && value !== '') {
        value = Number(value)
      }
    }
    const normalizedKey = key.trim().toLowerCase()
    normalized[normalizedKey] = value
  }
  return normalized
}

function extractHeaders(csvText) {
  const text = csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText
  const headers = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      headers.push(current)
      current = ''
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      headers.push(current)
      current = ''
      break
    } else {
      current += char
    }
  }
  if (current) {
    headers.push(current)
  }
  return headers.map(h => h.trim())
}

module.exports = {
  parseCSV,
  validateRow,
  normalizeData,
  extractHeaders
}