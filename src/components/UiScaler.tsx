import { useEffect } from 'react';

const FONT_SIZES: Record<'default' | 'large' | 'very large', string> = {
  default: '16px',
  large: '18px',
  'very large': '20px',
};

export function UiScaler() {
  useEffect(() => {
    const scale = (localStorage.getItem('uiScale') as 'default' | 'large' | 'very large') ?? 'default';
    const root = document.documentElement;
    if (FONT_SIZES[scale]) {
      root.style.fontSize = FONT_SIZES[scale];
    }
  }, []);

  return null;
}