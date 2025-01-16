export type TestStatus = 'Passed' | 'Failed' | 'Skipped' | 'Pending';

export type TestType = 'Unit' | 'Integration' | 'Module' | 'E2e';

export interface TestResult {
  testId: string;
  name: string;
  requirement: string;
  type: TestType;
  manual: boolean;
  status: TestStatus;
  link: string;
}

