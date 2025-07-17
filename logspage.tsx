export function LogsPage({merchantId}: LogsPageProps) {
  const authenticatedFetch = useAuthenticatedFetch()
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [filterQuery, setFilterQuery] = useState<string>('')
  const [filterLevel, setFilterLevel] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState<boolean>(false)
  const [isClearModalActive, setIsClearModalActive] = useState<boolean>(false)
  const [toastActive, setToastActive] = useState<boolean>(false)
  const [toastContent, setToastContent] = useState<string>('')

  const availableFilters = useMemo(
    () => [
      {
        key: 'level',
        label: 'Level',
        filter: (
          <Filters.Disclosure
            title="Level"
            options={[
              {label: 'Info', value: 'info'},
              {label: 'Warning', value: 'warning'},
              {label: 'Error', value: 'error'},
            ]}
            selected={filterLevel}
            onSelect={(values: string[]) => setFilterLevel(values)}
          />
        ),
      },
    ],
    [filterLevel],
  )

  const queryFilters = useMemo(() => {
    const filters: {key: string; value: string; label: string}[] = []
    if (filterLevel.length) {
      filters.push({
        key: 'level',
        value: filterLevel.join(','),
        label: `Level: ${filterLevel.join(', ')}`,
      })
    }
    if (filterQuery) {
      filters.push({
        key: 'query',
        value: filterQuery,
        label: `Search: ${filterQuery}`,
      })
    }
    return filters
  }, [filterLevel, filterQuery])

  const handleFiltersClear = useCallback(() => {
    setFilterLevel([])
    setFilterQuery('')
  }, [])

  const handleQueryChange = useCallback((value: string) => {
    setFilterQuery(value)
  }, [])

  const toggleFilters = useCallback(() => {
    setShowFilters((prev) => !prev)
  }, [])

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('merchantId', merchantId)
      if (filterLevel.length) {
        params.append('level', filterLevel.join(','))
      }
      if (filterQuery) {
        params.append('query', filterQuery)
      }
      const response = await authenticatedFetch(`/api/logs?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch logs')
      const data: Log[] = await response.json()
      setLogs(data)
    } catch (error) {
      console.error(error)
      setToastContent('Error fetching logs')
      setToastActive(true)
    } finally {
      setLoading(false)
    }
  }, [authenticatedFetch, merchantId, filterLevel, filterQuery])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleClearLogs = useCallback(async () => {
    setLoading(true)
    try {
      const response = await authenticatedFetch('/api/logs/clear', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({merchantId}),
      })
      if (!response.ok) throw new Error('Failed to clear logs')
      setToastContent('Logs cleared successfully')
      setToastActive(true)
      await fetchLogs()
    } catch (error) {
      console.error(error)
      setToastContent('Error clearing logs')
      setToastActive(true)
    } finally {
      setLoading(false)
      setIsClearModalActive(false)
    }
  }, [authenticatedFetch, merchantId, fetchLogs])

  const activator = (
    <Button destructive onClick={() => setIsClearModalActive(true)}>
      Clear Logs
    </Button>
  )

  return (
    <Page title="Logs" primaryAction={activator}>
      <Layout>
        <Layout.Section>
          <Card>
            <Card.Section>
              <Filters
                queryPlaceholder="Search logs"
                filters={availableFilters}
                appliedFilters={queryFilters}
                onQueryChange={handleQueryChange}
                onQueryClear={() => handleQueryChange('')}
                onClearAll={handleFiltersClear}
                onShowFiltersChange={toggleFilters}
                showFilters={showFilters}
                showClearButton
              />
            </Card.Section>
            <Card.Section>
              {loading ? (
                <div style={{padding: '2rem', textAlign: 'center'}}>
                  <Spinner size="large" />
                </div>
              ) : (
                <ResourceList
                  items={logs}
                  renderItem={(log) => {
                    const {id, timestamp, level, message} = log
                    const levelMarkup = {
                      info: <Badge status="info">Info</Badge>,
                      warning: <Badge status="warning">Warning</Badge>,
                      error: <Badge status="critical">Error</Badge>,
                    }[level]
                    return (
                      <ResourceList.Item id={id} accessibilityLabel={`Log ${id}`}>
                        <Stack wrap={false} alignment="center">
                          <div style={{minWidth: '150px'}}>
                            <TextStyle variation="subdued">
                              {new Date(timestamp).toLocaleString()}
                            </TextStyle>
                          </div>
                          <div>{levelMarkup}</div>
                          <div>
                            <TextStyle>{message}</TextStyle>
                          </div>
                        </Stack>
                      </ResourceList.Item>
                    )
                  }}
                />
              )}
            </Card.Section>
          </Card>
        </Layout.Section>
      </Layout>

      <Modal
        open={isClearModalActive}
        onClose={() => setIsClearModalActive(false)}
        title="Clear All Logs"
        primaryAction={{
          content: 'Clear Logs',
          destructive: true,
          onAction: handleClearLogs,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setIsClearModalActive(false),
          },
        ]}
      >
        <Modal.Section>
          <TextStyle>
            Are you sure you want to clear all logs? This action cannot be undone.
          </TextStyle>
        </Modal.Section>
      </Modal>

      {toastActive && (
        <Toast content={toastContent} onDismiss={() => setToastActive(false)} />
      )}
    </Page>
  )
}