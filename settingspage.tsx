// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Banner,
  Spinner,
  Toast,
} from '@shopify/polaris'
const SettingsPage: React.FC<SettingsPageProps> = ({merchantId}) => {
  const [settings, setSettings] = useState<Settings>({
    apiUrl: '',
    apiKey: '',
    scheduleCron: '',
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    apiUrl?: string;
    apiKey?: string;
    scheduleCron?: string;
  }>({});
  const [toastActive, setToastActive] = useState<boolean>(false);
  const [toastContent, setToastContent] = useState<string>('');
  const [toastError, setToastError] = useState<boolean>(false);

  const isMounted = useRef<boolean>(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const validateField = useCallback((field: keyof Settings, value: string) => {
    let error: string | undefined;
    switch (field) {
      case 'apiUrl':
        if (!value.trim()) {
          error = 'API URL is required';
        } else if (!isValidUrl(value.trim())) {
          error = 'Invalid URL format';
        }
        break;
      case 'apiKey':
        if (!value.trim()) {
          error = 'API Key is required';
        }
        break;
      case 'scheduleCron':
        if (!value.trim()) {
          error = 'Cron schedule is required';
        } else if (!isValidCron(value.trim())) {
          error = 'Invalid cron format';
        }
        break;
    }
    setValidationErrors(prev => {
      const { [field]: removed, ...rest } = prev;
      return error ? { ...rest, [field]: error } : rest;
    });
  }, []);

  const isFormValid =
    settings.apiUrl.trim() !== '' &&
    settings.apiKey.trim() !== '' &&
    settings.scheduleCron.trim() !== '' &&
    Object.keys(validationErrors).length === 0;

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const controller = new AbortController();
    try {
      const data = await fetchSettings(merchantId, controller.signal);
      if (!isMounted.current) return;
      setSettings({
        apiUrl: data.apiUrl || '',
        apiKey: data.apiKey || '',
        scheduleCron: data.scheduleCron || '',
      });
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      console.error('Error loading settings:', error);
      if (isMounted.current) {
        setFetchError('Failed to load settings. Please try again later.');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
    return () => {
      controller.abort();
    };
  }, [merchantId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleFieldChange = (field: keyof Settings) => (value: string) => {
    setSettings(prev => ({...prev, [field]: value}));
    validateField(field, value);
  };

  const showToast = (message: string, error: boolean = false) => {
    setToastContent(message);
    setToastError(error);
    setToastActive(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings(merchantId, settings);
      showToast('Settings saved successfully.', false);
    } catch (error: unknown) {
      console.error('Error saving settings:', error);
      showToast('Failed to save settings.', true);
    } finally {
      if (isMounted.current) setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const result = await testConnection(merchantId, settings);
      showToast(result.message || 'Connection successful.', false);
    } catch (error: unknown) {
      console.error('Error testing connection:', error);
      const message = error instanceof Error ? error.message : 'Connection test failed.';
      showToast(message, true);
    } finally {
      if (isMounted.current) setTesting(false);
    }
  };

  const toggleToast = () => setToastActive(active => !active);

  return (
    <Page
      title="Settings"
      primaryAction={{
        content: saving ? <Spinner size="small" /> : 'Save',
        onAction: handleSave,
        disabled: loading || saving || testing || !isFormValid,
      }}
      secondaryActions={[
        {
          content: testing ? <Spinner size="small" /> : 'Test Connection',
          onAction: handleTestConnection,
          disabled: loading || saving || testing || !isFormValid,
        },
      ]}
    >
      <Layout>
        <Layout.Section>
          {fetchError && <Banner status="critical">{fetchError}</Banner>}
          <Card sectioned>
            {loading ? (
              <div style={{padding: '2rem', textAlign: 'center'}}><Spinner /></div>
            ) : (
              <FormLayout>
                <TextField
                  label="API URL"
                  value={settings.apiUrl}
                  onChange={handleFieldChange('apiUrl')}
                  placeholder="https://api.example.com/endpoint"
                  autoComplete="off"
                  error={validationErrors.apiUrl}
                />
                <TextField
                  label="API Key"
                  type="password"
                  value={settings.apiKey}
                  onChange={handleFieldChange('apiKey')}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  error={validationErrors.apiKey}
                />
                <TextField
                  label="Sync Schedule (Cron)"
                  value={settings.scheduleCron}
                  onChange={handleFieldChange('scheduleCron')}
                  placeholder="0 * * * *"
                  helpText="Use cron format to schedule syncs."
                  autoComplete="off"
                  error={validationErrors.scheduleCron}
                />
              </FormLayout>
            )}
          </Card>
        </Layout.Section>
      </Layout>
      {toastActive && (
        <Toast
          content={toastContent}
          error={toastError}
          onDismiss={toggleToast}
        />
      )}
    </Page>
  );
};

export default SettingsPage;
