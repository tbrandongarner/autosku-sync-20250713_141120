import React from 'react'
import {
  Page,
  Button,
  Layout,
  Card,
  Banner,
  Stack,
  Spinner,
  DataTable,
  TextContainer,
} from '@shopify/polaris'
import { useQuery } from 'react-query'
import {
  fetchSyncStatus,
  fetchUsageStatistics,
  fetchAppHealth,
  SyncStatus,
  UsageStatistics,
  AppHealth,
} from './api'
const DASHBOARD_STALE_TIME = 1000 * 60 * 5

interface DashboardProps {
  merchantId: string
}

function Dashboard({ merchantId }: DashboardProps) {
  const {
    data: syncStatus,
    isLoading: isLoadingSync,
    isFetching: isFetchingSync,
    isError: isErrorSync,
    error: errorSync,
    refetch: refetchSync,
  } = useQuery(
    ['syncStatus', merchantId],
    () => fetchSyncStatus(merchantId),
    { staleTime: DASHBOARD_STALE_TIME }
  )

  const {
    data: usageStats,
    isLoading: isLoadingUsage,
    isFetching: isFetchingUsage,
    isError: isErrorUsage,
    error: errorUsage,
    refetch: refetchUsage,
  } = useQuery(
    ['usageStatistics', merchantId],
    () => fetchUsageStatistics(merchantId),
    { staleTime: DASHBOARD_STALE_TIME }
  )

  const {
    data: appHealth,
    isLoading: isLoadingHealth,
    isFetching: isFetchingHealth,
    isError: isErrorHealth,
    error: errorHealth,
    refetch: refetchHealth,
  } = useQuery(
    ['appHealth', merchantId],
    () => fetchAppHealth(merchantId),
    { staleTime: DASHBOARD_STALE_TIME }
  )

  const isAnyFetching =
    isLoadingSync ||
    isLoadingUsage ||
    isLoadingHealth ||
    isFetchingSync ||
    isFetchingUsage ||
    isFetchingHealth

  const handleRefresh = () => {
    refetchSync()
    refetchUsage()
    refetchHealth()
  }

  return (
    <Page
      fullWidth
      title="Dashboard"
      primaryAction={
        <Button onClick={handleRefresh} disabled={isAnyFetching} loading={isAnyFetching}>
          Refresh
        </Button>
      }
    >
      {isAnyFetching && (
        <Banner status="info">
          <Stack spacing="tight" alignment="center">
            <Spinner size="small" />
            <span>Loading dashboard data...</span>
          </Stack>
        </Banner>
      )}
      <Layout>
        <Layout.Section>
          <Card title="Sync Status" sectioned>
            {isErrorSync && <Banner status="critical">{errorSync?.message}</Banner>}
            {!isLoadingSync && syncStatus && (
              <TextContainer>
                <p>Last Synced At: {new Date(syncStatus.lastSyncedAt).toLocaleString()}</p>
                <p>Status: {syncStatus.isSyncing ? 'In Progress' : 'Idle'}</p>
                {syncStatus.lastError && <Banner status="critical">Last Error: {syncStatus.lastError}</Banner>}
              </TextContainer>
            )}
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card title="Usage Statistics" sectioned>
            {isErrorUsage && <Banner status="critical">{errorUsage?.message}</Banner>}
            {!isLoadingUsage && usageStats && (
              <DataTable
                columnContentTypes={['text', 'numeric']}
                headings={['Metric', 'Value']}
                rows={[
                  ['Daily Calls', usageStats.dailyCalls],
                  ['Monthly Calls', usageStats.monthlyCalls],
                  ['Call Limit', usageStats.callLimit],
                ]}
              />
            )}
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card title="App Health" sectioned>
            {isErrorHealth && <Banner status="critical">{errorHealth?.message}</Banner>}
            {!isLoadingHealth && appHealth && (
              <DataTable
                columnContentTypes={['text', 'numeric']}
                headings={['Metric', 'Percentage']}
                rows={[
                  ['Uptime', `${appHealth.uptimePercentage}%`],
                  ['Error Rate', `${appHealth.errorRatePercentage}%`],
                ]}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  )
}

export default Dashboard