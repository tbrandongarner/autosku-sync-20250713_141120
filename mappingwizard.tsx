const MappingWizard: React.FC<MappingWizardProps> = ({existingConfig, onFinish}) => {
  const [step, setStep] = useState<number>(0);
  const [feedConfig, setFeedConfig] = useState<FeedConfig>(
    existingConfig?.feedConfig || {sourceType: 'csv'},
  );
  const [fieldDefinitions, setFieldDefinitions] = useState<FieldDefinition[]>(
    existingConfig?.fieldDefinitions || [],
  );

  const handleNextFromFeed = (config: FeedConfig) => {
    setFeedConfig(config);
    setStep(1);
  };

  const handleNextFromFields = (fields: FieldDefinition[]) => {
    setFieldDefinitions(fields);
    setStep(2);
  };

  const handleBack = () => {
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleFinish = () => {
    onFinish({feedConfig, fieldDefinitions});
  };

  return (
    <Page title="Mapping Wizard">
      <Card sectioned>
        {step === 0 && (
          <MappingStepSelectFeed
            initialConfig={feedConfig}
            onNext={handleNextFromFeed}
          />
        )}
        {step === 1 && (
          <MappingStepDefineFields
            feedConfig={feedConfig}
            initialFields={fieldDefinitions}
            onNext={handleNextFromFields}
            onBack={handleBack}
          />
        )}
        {step === 2 && (
          <MappingStepReview
            mappingConfig={{feedConfig, fieldDefinitions}}
            onBack={handleBack}
            onFinish={handleFinish}
          />
        )}
      </Card>
    </Page>
  );
};

interface StepSelectFeedProps {
  initialConfig: FeedConfig;
  onNext: (config: FeedConfig) => void;
}

const MappingStepSelectFeed: React.FC<StepSelectFeedProps> = ({
  initialConfig,
  onNext,
}) => {
  const [sourceType, setSourceType] = useState<FeedSourceType>(
    initialConfig.sourceType,
  );
  const [csvFile, setCsvFile] = useState<File | undefined>(
    initialConfig.csvFile,
  );
  const [googleSheetId, setGoogleSheetId] = useState<string>(
    initialConfig.googleSheetId || '',
  );
  const [worksheetName, setWorksheetName] = useState<string>(
    initialConfig.worksheetName || '',
  );
  const [errors, setErrors] = useState<{
    csvFile?: string;
    googleSheetId?: string;
    worksheetName?: string;
  }>({});

  const csvDropZoneID = 'csv-dropzone';
  const googleSheetIdFieldID = 'googleSheetId';
  const worksheetNameFieldID = 'worksheetName';

  useEffect(() => {
    if (sourceType === 'csv') {
      setGoogleSheetId('');
      setWorksheetName('');
      setErrors((prev) => ({
        ...prev,
        googleSheetId: undefined,
        worksheetName: undefined,
      }));
    } else {
      setCsvFile(undefined);
      setErrors((prev) => ({...prev, csvFile: undefined}));
    }
  }, [sourceType]);

  const validate = (): boolean => {
    const errs: typeof errors = {};
    if (sourceType === 'csv') {
      if (!csvFile) {
        errs.csvFile = 'Please upload a CSV file.';
      }
    } else {
      if (!googleSheetId.trim()) {
        errs.googleSheetId = 'Google Sheet ID is required.';
      }
      if (!worksheetName.trim()) {
        errs.worksheetName = 'Worksheet name is required.';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (!validate()) return;
    onNext({
      sourceType,
      csvFile: sourceType === 'csv' ? csvFile : undefined,
      googleSheetId:
        sourceType === 'google_sheets' ? googleSheetId : undefined,
      worksheetName:
        sourceType === 'google_sheets' ? worksheetName : undefined,
    });
  };

  const fileDrop = useCallback(
    (_dropFiles: File[], acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        setCsvFile(acceptedFiles[0]);
        setErrors((prev) => ({...prev, csvFile: undefined}));
      }
    },
    [],
  );

  return (
    <FormLayout>
      <FormLayout.Group>
        <RadioButton
          label="Upload CSV"
          checked={sourceType === 'csv'}
          id="csv"
          name="sourceType"
          onChange={() => setSourceType('csv')}
        />
        <RadioButton
          label="Google Sheets"
          checked={sourceType === 'google_sheets'}
          id="google"
          name="sourceType"
          onChange={() => setSourceType('google_sheets')}
        />
      </FormLayout.Group>
      {sourceType === 'csv' && (
        <div id={csvDropZoneID}>
          <DropZone onDrop={fileDrop}>
            <DropZone.FileUpload />
            {csvFile && (
              <Stack alignment="center">
                <Stack.Item fill>{csvFile.name}</Stack.Item>
                <Button onClick={() => setCsvFile(undefined)}>
                  Remove
                </Button>
              </Stack.Item>
            )}
          </DropZone>
          {errors.csvFile && (
            <InlineError
              message={errors.csvFile}
              fieldID={csvDropZoneID}
            />
          )}
        </div>
      )}
      {sourceType === 'google_sheets' && (
        <FormLayout>
          <TextField
            id={googleSheetIdFieldID}
            label="Google Sheet ID"
            value={googleSheetId}
            onChange={(value) => {
              setGoogleSheetId(value);
              setErrors((prev) => ({...prev, googleSheetId: undefined}));
            }}
            error={errors.googleSheetId}
          />
          <TextField
            id={worksheetNameFieldID}
            label="Worksheet Name"
            value={worksheetName}
            onChange={(value) => {
              setWorksheetName(value);
              setErrors((prev) => ({...prev, worksheetName: undefined}));
            }}
            error={errors.worksheetName}
          />
        </FormLayout>
      )}
      <ButtonGroup>
        <Button primary onClick={handleNext}>
          Next
        </Button>
      </ButtonGroup>
    </FormLayout>
  );
};

interface StepDefineFieldsProps {
  feedConfig: FeedConfig;
  initialFields: FieldDefinition[];
  onNext: (fields: FieldDefinition[]) => void;
  onBack: () => void;
}

const shopifyFieldOptions = [
  {label: 'Title', value: 'title'},
  {label: 'SKU', value: 'sku'},
  {label: 'Price', value: 'price'},
  {label: 'Inventory Quantity', value: 'inventory_quantity'},
];

const MappingStepDefineFields: React.FC<StepDefineFieldsProps> = ({
  feedConfig,
  initialFields,
  onNext,
  onBack,
}) => {
  const [fields, setFields] = useState<FieldDefinition[]>(
    initialFields.length > 0
      ? initialFields
      : [
          {
            id: nanoid(),
            shopifyField: '',
            feedField: '',
            defaultValue: '',
          },
        ],
  );
  const [errors, setErrors] = useState<string>('');

  const updateField = (
    id: string,
    key: keyof FieldDefinition,
    value: string,
  ) => {
    setFields((prev) =>
      prev.map((f) => (f.id === id ? {...f, [key]: value} : f)),
    );
  };

  const addRow = () => {
    setFields((prev) => [
      ...prev,
      {
        id: nanoid(),
        shopifyField: '',
        feedField: '',
        defaultValue: '',
      },
    ]);
  };

  const removeRow = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  const validate = (): boolean => {
    if (fields.length === 0) {
      setErrors('At least one field mapping is required.');
      return false;
    }
    for (const f of fields) {
      if (!f.shopifyField || !f.feedField) {
        setErrors('All mappings must have both Shopify and Feed fields.');
        return false;
      }
    }
    const duplicates = fields
      .map((f) => f.shopifyField)
      .filter((v, i, arr) => v && arr.indexOf(v) !== i);
    if (duplicates.length > 0) {
      setErrors('Duplicate Shopify fields are not allowed.');
      return false;
    }
    setErrors('');
    return true;
  };

  const handleNext = () => {
    if (!validate()) return;
    onNext(fields);
  };

  const firstFieldId = fields.length > 0 ? fields[0].id : '';

  return (
    <FormLayout>
      <Stack vertical spacing="tight">
        {fields.map((f, idx) => (
          <Card key={f.id} sectioned>
            <FormLayout>
              <Select
                id={`shopifyField-${f.id}`}
                label={`Shopify Field #${idx + 1}`}
                options={shopifyFieldOptions}
                value={f.shopifyField}
                onChange={(value) => updateField(f.id, 'shopifyField', value)}
              />
              <TextField
                id={`feedField-${f.id}`}
                label="Feed Field"
                value={f.feedField}
                onChange={(value) => updateField(f.id, 'feedField', value)}
              />
              <TextField
                id={`defaultValue-${f.id}`}
                label="Default Value (optional)"
                value={f.defaultValue || ''}
                onChange={(value) =>
                  updateField(f.id, 'defaultValue', value)
                }
              />
              <Button destructive onClick={() => removeRow(f.id)}>
                Remove
              </Button>
            </FormLayout>
          </Card>
        ))}
        <Button onClick={addRow}>Add Mapping</Button>
      </Stack>
      {errors && (
        <InlineError
          message={errors}
          fieldID={`shopifyField-${firstFieldId}`}
        />
      )}
      <ButtonGroup>
        <Button onClick={onBack}>Back</Button>
        <Button primary onClick={handleNext}>
          Next
        </Button>
      </ButtonGroup>
    </FormLayout>
  );
};

interface StepReviewProps {
  mappingConfig: MappingConfig;
  onBack: () => void;
  onFinish: () => void;
}

const MappingStepReview: React.FC<StepReviewProps> = ({
  mappingConfig,
  onBack,
  onFinish,
}) => {
  const {feedConfig, fieldDefinitions} = mappingConfig;

  const feedDetails = () => {
    if (feedConfig.sourceType === 'csv') {
      return 'CSV Upload: ' + (feedConfig.csvFile?.name || '');
    } else {
      return (
        'Google Sheet ID: ' +
        feedConfig.googleSheetId +
        ', Worksheet: ' +
        feedConfig.worksheetName
      );
    }
  };

  const rows = fieldDefinitions.map((f) => [
    f.shopifyField,
    f.feedField,
    f.defaultValue || '-',
  ]);

  return (
    <FormLayout>
      <Card title="Review Configuration" sectioned>
        <FormLayout>
          <TextField label="Feed Source" readOnly value={feedDetails()} />
          <DataTable
            columnContentTypes={['text', 'text', 'text']}
            headings={['Shopify Field', 'Feed Field', 'Default Value']}
            rows={rows}
            footerContent={`Total mappings: ${fieldDefinitions.length}`}
          />
        </FormLayout>
      </Card>
      <ButtonGroup>
        <Button onClick={onBack}>Back</Button>
        <Button primary onClick={onFinish}>
          Finish
        </Button>
      </ButtonGroup>
    </FormLayout>
  );
};

export default MappingWizard;