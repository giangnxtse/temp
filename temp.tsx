export interface TestResult {
  id: string;
  testType: TestType;
  serviceName?: string;
  moduleName?: string;
  branchName: string;
  buildVersion: string;
  numTests: number;
  numRequirements: number;
  results: {
    passed: number;
    failed: number;
    blocked: number;
    notStarted: number;
    broken: number;
    skipped: number;
    inProgress: number;
  };
}

export interface SearchFormProps {
  onSearch: (filters: any) => void;
  testType: TestType;
  setTestType: (type: TestType) => void;
}

export interface ResultsProps {
  results: TestResult[];
}

