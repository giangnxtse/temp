import React from 'react';
import { Grid, Card, CardContent, Typography, Box, Tooltip, Divider, Chip } from '@mui/material';
import { CheckCircle, XCircle, AlertTriangle, Clock, Bug, SkipForward, Play, Code, GitBranch, Package, Database, BarChart } from 'lucide-react';
import { ResultsProps, TestResult } from './types';

const StatusBox: React.FC<{ 
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}> = ({ label, value, icon, color }) => (
  <Box 
    sx={{ 
      display: 'flex',
      alignItems: 'center',
      bgcolor: `${color}15`,
      p: 1,
      borderRadius: 1,
      minWidth: '100px'
    }}
  >
    <Box sx={{ 
      color: color,
      display: 'flex',
      alignItems: 'center',
      mr: 1 
    }}>
      {icon}
    </Box>
    <Box>
      <Typography variant="h6" sx={{ color: color, lineHeight: 1, fontSize: '1rem' }}>
        {value}
      </Typography>
      <Typography variant="caption" sx={{ color: color }}>
        {label}
      </Typography>
    </Box>
  </Box>
);

const ResultCard: React.FC<{ result: TestResult }> = ({ result }) => {
  const totalTests = Object.values(result.results).reduce((a, b) => a + b, 0);
  const passRate = (result.results.passed / totalTests) * 100;

  return (
    <Card 
      elevation={2}
      sx={{
        '&:hover': {
          boxShadow: 6,
          transition: 'box-shadow 0.3s ease-in-out'
        },
        maxWidth: '600px',
        margin: '0 auto'
      }}
    >
      <CardContent sx={{ p: 2 }}>
        {/* Header Section */}
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Database className="mr-2 text-blue-600" size={20} />
              <Typography variant="h6" sx={{ color: 'primary.main' }}>
                dashboard-service
              </Typography>
            </Box>
            
            <Tooltip title={result.branchName} arrow>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                <GitBranch className="mr-1 text-gray-500" size={14} />
                <Typography variant="body2" color="text.secondary" sx={{ 
                  maxWidth: '200px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {result.branchName}
                </Typography>
              </Box>
            </Tooltip>
            
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Package className="mr-1 text-gray-500" size={14} />
              <Typography variant="body2" color="text.secondary">
                {result.buildVersion}
              </Typography>
            </Box>
          </Box>
          <Chip 
            label={result.testType} 
            color="primary" 
            size="small"
            sx={{ fontWeight: 'bold' }}
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Metrics Section */}
        <Box sx={{ mb: 2 }}>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6}>
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                p: 1, 
                bgcolor: 'primary.light', 
                borderRadius: 1 
              }}>
                <Typography variant="h4" color="primary.contrastText">
                  {result.numTests}
                </Typography>
                <Typography variant="body2" color="primary.contrastText">Tests</Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                p: 1, 
                bgcolor: 'secondary.light', 
                borderRadius: 1 
              }}>
                <Typography variant="h4" color="secondary.contrastText">
                  {result.numRequirements}
                </Typography>
                <Typography variant="body2" color="secondary.contrastText">Requirements</Typography>
              </Box>
            </Grid>
          </Grid>

          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2">Pass Rate</Typography>
              <Typography variant="body2" color={passRate >= 70 ? 'success.main' : 'error.main'}>
                {passRate.toFixed(1)}%
              </Typography>
            </Box>
            <Box 
              sx={{
                height: 8,
                width: '100%',
                bgcolor: 'grey.200',
                borderRadius: 4,
                overflow: 'hidden'
              }}
            >
              <Box
                sx={{
                  width: `${passRate}%`,
                  height: '100%',
                  bgcolor: passRate >= 70 ? 'success.main' : 'error.main',
                  transition: 'width 0.5s ease-in-out'
                }}
              />
            </Box>
          </Box>
        </Box>

        {/* Results Grid */}
        <Grid container spacing={1}>
          <Grid item xs={6} sm={4}>
            <StatusBox
              label="Passed"
              value={result.results.passed}
              icon={<CheckCircle size={16} />}
              color="#2e7d32"
            />
          </Grid>
          <Grid item xs={6} sm={4}>
            <StatusBox
              label="Failed"
              value={result.results.failed}
              icon={<XCircle size={16} />}
              color="#d32f2f"
            />
          </Grid>
          <Grid item xs={6} sm={4}>
            <StatusBox
              label="Blocked"
              value={result.results.blocked}
              icon={<AlertTriangle size={16} />}
              color="#ed6c02"
            />
          </Grid>
          <Grid item xs={6} sm={4}>
            <StatusBox
              label="Not Started"
              value={result.results.notStarted}
              icon={<Clock size={16} />}
              color="#0288d1"
            />
          </Grid>
          <Grid item xs={6} sm={4}>
            <StatusBox
              label="Broken"
              value={result.results.broken}
              icon={<Bug size={16} />}
              color="#f44336"
            />
          </Grid>
          <Grid item xs={6} sm={4}>
            <StatusBox
              label="Skipped"
              value={result.results.skipped}
              icon={<SkipForward size={16} />}
              color="#757575"
            />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

const ResultsDisplay: React.FC<ResultsProps> = ({ results }) => {
  return (
    <Grid container spacing={2}>
      {results.map((result) => (
        <Grid item xs={12} key={result.id}>
          <ResultCard result={result} />
        </Grid>
      ))}
    </Grid>
  );
};

export default ResultsDisplay;

