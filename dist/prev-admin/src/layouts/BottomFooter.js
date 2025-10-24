import React from 'react';
import { useDarkMode } from '../context/DarkModeContext';

const BottomFooter = () => {
  const { useDarkMode: isDarkMode } = useDarkMode(); // Use the dark mode state

  return (
    <div style={{ 
      backgroundColor: isDarkMode ? '#1b232d' : '#ffffff', // Change based on dark mode
      color: isDarkMode ? 'white' : 'black', // Change based on dark mode
      padding: '10px 20px', 
      textAlign: 'center' 
    }}>
      {/* Empty placeholder for footer */}
    </div>
  );
};

export default BottomFooter;
