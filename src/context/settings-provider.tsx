'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'dark' | 'light' | 'system';
type TextSize = 'sm' | 'md' | 'lg';

interface SettingsContextProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  textSize: TextSize;
  setTextSize: (size: TextSize) => void;
  audioDeviceId: string | null;
  setAudioDeviceId: (deviceId: string) => void;
}

const SettingsContext = createContext<SettingsContextProps | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [textSize, setTextSizeState] = useState<TextSize>('md');
  const [audioDeviceId, setAudioDeviceIdState] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const storedTheme = localStorage.getItem('theme') as Theme | null;
    const storedTextSize = localStorage.getItem('textSize') as TextSize | null;
    const storedAudioDevice = localStorage.getItem('audioDeviceId') as string | null;
    
    if (storedTheme) setThemeState(storedTheme);
    if (storedTextSize) setTextSizeState(storedTextSize);
    if (storedAudioDevice) setAudioDeviceIdState(storedAudioDevice);

  }, []);

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem('theme', newTheme);
    setThemeState(newTheme);
  };

  const setTextSize = (newSize: TextSize) => {
    localStorage.setItem('textSize', newSize);
    setTextSizeState(newSize);
  };

  const setAudioDeviceId = (deviceId: string) => {
    localStorage.setItem('audioDeviceId', deviceId);
    setAudioDeviceIdState(deviceId);
  }

  useEffect(() => {
    if (!isMounted) return;
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme, isMounted]);

   useEffect(() => {
    if (!isMounted) return;
    const body = window.document.body;
    body.classList.remove('text-sm', 'text-base', 'text-lg');

    switch (textSize) {
      case 'sm':
        body.classList.add('text-sm');
        break;
      case 'lg':
        body.classList.add('text-lg');
        break;
      default:
        body.classList.add('text-base');
        break;
    }
  }, [textSize, isMounted]);


  const contextValue = {
      theme, setTheme,
      textSize, setTextSize,
      audioDeviceId, setAudioDeviceId,
  };

  // Prevent hydration mismatch by returning null on the server
  if (!isMounted) return null;

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
