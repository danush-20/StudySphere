import React, { createContext, useContext, useState } from 'react';

export const LIGHT = {
  primary: '#102A43',
  secondary: '#D9E2EC',
  accent: '#334E68',
  background: '#F0F4F8',
  surface: '#FFFFFF',
  surfaceHigh: '#F0F4F8',
  surfaceHighest: '#E8EDF2',
  text: '#102A43',
  textSecondary: '#486581',
  border: '#BCCCDC',
  white: '#FFFFFF',
  highlight: '#F0A500',
  success: '#3EBD93',
  error: '#E53935',
  warning: '#F0A500',
  inputBg: '#D9E2EC',
  modalBg: '#FFFFFF',
  quoteCard: 'rgba(217, 226, 236, 0.9)',
  quoteText: '#102A43',
  quoteAuthor: '#486581',
  overlayBg: 'rgba(16, 42, 67, 0.45)',
  onPrimary: '#FFFFFF',
  ghostBorder: '#BCCCDC',
  primaryGradient: ['#102A43', '#102A43'],
  primaryBtn: '#102A43',
  primaryBtnText: '#FFFFFF',
  secondaryBtn: '#D1E9FF',
  secondaryBtnText: '#102A43',
  hostedCard: '#102A43', // deep navy card
  joinedCard: '#D9E2EC', // soft blue-grey card
  nearbyCard: '#FFFFFF',
  timerText: '#102A43',
  timerRing: '#102A43',
  timerRingBg: '#D9E2EC',
  chatBtn: '#102A43',
  chatBtnText: '#FFFFFF',
  mediaBtn: '#FFFFFF',
  mediaBtnText: '#102A43',
};

export const DARK = {
  primary: '#8ED5FF', // light blue — for text, icons, accents only
  secondary: '#171F33',
  accent: '#BDC8D1',
  background: '#0B1326', // deepest layer
  surface: '#111827', // cards, sheets
  surfaceHigh: '#1A2236', // slightly lifted surface
  surfaceHighest: '#222A3D', // modals, popovers
  text: '#DAE2FD',
  textSecondary: '#8BA3BC',
  border: 'rgba(142, 213, 255, 0.08)', // very subtle blue tint border
  white: '#DAE2FD',
  highlight: '#FFC176',
  success: '#3EBD93',
  error: '#EF5350',
  warning: '#FFC176',
  inputBg: '#1A2236',
  modalBg: '#222A3D',
  quoteCard: '#151F2E', // dark card, no transparency issues
  quoteText: '#DAE2FD', // white text for quote
  quoteAuthor: '#FFC176', // amber for author — matches image
  overlayBg: 'rgba(0, 0, 0, 0.7)',
  onPrimary: '#00354A',
  ghostBorder: 'rgba(62, 72, 79, 0.15)',
  primaryGradient: ['#8ED5FF', '#38BDF8'],

  // Buttons
  primaryBtn: '#1A3A5C', // dark navy button — not bright blue
  primaryBtnText: '#8ED5FF', // light blue text on dark button
  secondaryBtn: '#1A2236',
  secondaryBtnText: '#8ED5FF',

  // Session cards — dark surfaces, NOT light blue
  hostedCard: '#0F2137', // deep navy — like the image
  joinedCard: '#141E2E', // slightly lighter navy
  nearbyCard: '#1A2236',

  // Timer
  timerText: '#DAE2FD',
  timerRing: '#8ED5FF',
  timerRingBg: '#1A2236',

  // StudyGroup bottom sheet buttons
  chatBtn: '#0F2137',
  chatBtnText: '#8ED5FF',
  mediaBtn: '#1A2236',
  mediaBtnText: '#FFC176',
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);
  const COLORS = isDark ? DARK : LIGHT;
  const toggleTheme = () => setIsDark(prev => !prev);

  return (
    <ThemeContext.Provider value={{ COLORS, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
