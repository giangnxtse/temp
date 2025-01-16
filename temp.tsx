import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  Pagination,
  Box,
  Typography,
} from '@mui/material';
import { TestResult } from '../types/TestResult';
import { TestResultItem } from './TestResultItem';
import usePagination from '../hooks/usePagination';

interface TestResultPopupProps {
  open: boolean;
  onClose: () => void;
  results: TestResult[];
}

export const TestResultPopup: React.FC<TestResultPopupProps> = ({ open, onClose, results }) => {
  const { paginatedItems, currentPage, totalPages, nextPage, prevPage } = usePagination(results, 10);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Test Results</DialogTitle>
      <DialogContent>
        <List sx={{ minHeight: '300px', maxHeight: '500px', overflow: 'auto' }}>
          {paginatedItems.map((result) => (
            <TestResultItem key={result.testId} result={result} />
          ))}
        </List>
        <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
          <Typography variant="body2">
            Showing {(currentPage - 1) * 10 + 1} - {Math.min(currentPage * 10, results.length)} of {results.length} results
          </Typography>
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={(_, page) => page > currentPage ? nextPage() : prevPage()}
          />
        </Box>
      </DialogContent>
    </Dialog>
  );
};

