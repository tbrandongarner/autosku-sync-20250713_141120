export interface SyncStatus {
  lastSyncedAt: string
  isSyncing: boolean
  lastError?: string
}

export interface UsageStatistics {
  dailyCalls: number
  monthlyCalls: number
  callLimit: number
}

export interface AppHealth {
  uptimePercentage: number
  errorRatePercentage: number
}

export interface Settings {
  apiUrl: string
  apiKey: string
  scheduleCron: string
}

export async function fetchSyncStatus(_merchantId: string): Promise<SyncStatus> {
  return { lastSyncedAt: new Date().toISOString(), isSyncing: false }
}

export async function fetchUsageStatistics(_merchantId: string): Promise<UsageStatistics> {
  return { dailyCalls: 0, monthlyCalls: 0, callLimit: 0 }
}

export async function fetchAppHealth(_merchantId: string): Promise<AppHealth> {
  return { uptimePercentage: 100, errorRatePercentage: 0 }
}

export async function fetchSettings(_merchantId: string, _signal?: AbortSignal): Promise<Settings> {
  return { apiUrl: '', apiKey: '', scheduleCron: '' }
}

export async function saveSettings(_merchantId: string, _settings: Settings): Promise<void> {
  return
}

export async function testConnection(_merchantId: string, _settings: Settings): Promise<{ message: string }> {
  return { message: 'ok' }
}
