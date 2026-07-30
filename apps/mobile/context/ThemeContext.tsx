import React, { createContext, useContext } from 'react';
import { MidnightColors } from '../constants/theme';

type ThemeType = 'dark' | 'light';

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  colors: typeof MidnightColors;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const setTheme = () => {
    // Theme switching is disabled; EveBash app UI stays on the dark palette.
  };

  return (
    <ThemeContext.Provider value={{ theme: 'dark', setTheme, colors: MidnightColors, isDark: true }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within an AppThemeProvider');
  }
  return context;
}
