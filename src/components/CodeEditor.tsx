import React, { useState } from 'react';
import { Box, TextField } from '@mui/material';

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  error?: string | null;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ 
  code, 
  onChange,
  error = null
}) => {
  return (
    <Box sx={{ width: '100%' }}>
      <TextField
        fullWidth
        multiline
        rows={10}
        value={code}
        onChange={(e) => onChange(e.target.value)}
        variant="outlined"
        placeholder="Введите ваш код здесь..."
        error={!!error}
        helperText={error}
        sx={{
          '& .MuiOutlinedInput-root': {
            fontFamily: 'monospace',
            fontSize: '14px',
            backgroundColor: 'grey.900',
            '& fieldset': {
              borderColor: 'grey.700',
            },
            '&:hover fieldset': {
              borderColor: 'grey.500',
            },
            '&.Mui-focused fieldset': {
              borderColor: 'primary.main',
            },
          },
        }}
      />
    </Box>
  );
};

export default CodeEditor; 