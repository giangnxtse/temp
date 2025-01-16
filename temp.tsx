import React from 'react';
import { ListItem, ListItemText, Chip, IconButton, Tooltip, Box } from '@mui/material';
import { Assignment, CheckCircle, Cancel, HourglassEmpty, BugReport, OpenInNew } from '@mui/icons-material';
import { TestResult, TestStatus } from '../types/TestResult';

const getStatusColor = (status: TestStatus): string => {
  switch (status) {
    case 'Passed':
      return 'success';
    case 'Failed':
      return 'error';
    case 'Skipped':
      return 'warning';
    default:
      return 'info';
  }
};

const getStatusIcon = (status: TestStatus) => {
  switch (status) {
    case 'Passed':
      return <CheckCircle />;
    case 'Failed':
      return <Cancel />;
    case 'Skipped':
      return <HourglassEmpty />;
    default:
      return <BugReport />;
  }
};

interface TestResultItemProps {
  result: TestResult;
}

export const TestResultItem: React.FC<TestResultItemProps> = ({ result }) => {
  return (
    <ListItem
      divider
      secondaryAction={
        <Tooltip title="Open test details">
          <IconButton edge="end" aria-label="open test details" href={result.link} target="_blank">
            <OpenInNew />
          </IconButton>
        </Tooltip>
      }
    >
      <ListItemText
        primary={
          <Box display="flex" alignItems="center" gap={1}>
            <Tooltip title={result.testId}>
              <span>{result.testId.slice(0, 20)}...</span>
            </Tooltip>
            <Chip
              icon={getStatusIcon(result.status)}
              label={result.status}
              color={getStatusColor(result.status) as "success" | "error" | "warning" | "info"}
              size="small"
            />
          </Box>
        }
        secondary={
          <Box display="flex" flexDirection="column" gap={0.5}>
            <Tooltip title={result.name}>
              <span>{result.name.slice(0, 30)}...</span>
            </Tooltip>
            <Box display="flex" alignItems="center" gap={1}>
              <Chip icon={<Assignment />} label={result.requirement} size="small" variant="outlined" />
              <Chip label={result.type} size="small" variant="outlined" />
              <Chip label={result.manual ? 'Manual' : 'Automated'} size="small" variant="outlined" />
            </Box>
          </Box>
        }
      />
    </ListItem>
  );
};

