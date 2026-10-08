import { ThemeColors } from './types';

// Palette Tokens:
// Deep Forest: #063B00
// Leaf Green:  #266210
// Fresh Lime:  #90B800
// Citrus Gold: #E1E100

export const lightColors: ThemeColors = {
  // Brand / Primary
  primary: '#266210',
  primaryVariant: '#063B00',
  onPrimary: '#FFFFFF',
  secondary: '#90B800',
  secondaryVariant: '#6F8E00',
  onSecondary: '#063B00',

  // Background & Surfaces
  background: '#F7FAF5',
  onBackground: '#063B00',
  surface: '#FFFFFF',
  onSurface: '#063B00',
  surfaceVariant: '#EDF5E8',
  onSurfaceVariant: '#35532B',
  card: '#FFFFFF',
  onCard: '#063B00',

  // Typography
  textPrimary: '#063B00',
  textSecondary: '#4A6940',
  textTertiary: '#8FA885',
  textDisabled: '#C2D4BC',
  textInverse: '#F7FAF5',

  // Borders & Dividers
  border: '#DFECE8',
  borderFocus: '#266210',
  divider: '#EDF5E8',

  // Feedback & Status
  success: '#266210',
  onSuccess: '#FFFFFF',
  successContainer: '#EDF5E8',
  warning: '#D6A800',
  onWarning: '#063B00',
  warningContainer: '#FFFCE0',
  error: '#DC2626',
  onError: '#FFFFFF',
  errorContainer: '#FEE2E2',
  info: '#0284C7',
  onInfo: '#FFFFFF',
  infoContainer: '#E0F2FE',

  // Interactive & Form Inputs
  inputBackground: '#FFFFFF',
  inputBorder: '#D2E4CC',
  inputPlaceholder: '#8FA885',
  disabled: '#EDF5E8',
  onDisabled: '#8FA885',
  ripple: 'rgba(38, 98, 16, 0.12)',
  backdrop: 'rgba(6, 59, 0, 0.5)',
};

export const darkColors: ThemeColors = {
  // Brand / Primary
  primary: '#7CD448',
  primaryVariant: '#1B3813',
  onPrimary: '#0B2205',
  secondary: '#B8E610',
  secondaryVariant: '#93B808',
  onSecondary: '#0C1C03',

  // Background & Surfaces (Modern Obsidian-Forest Slate)
  background: '#0F140E',
  onBackground: '#F2F7EE',
  surface: '#182017',
  onSurface: '#F2F7EE',
  surfaceVariant: '#222D20',
  onSurfaceVariant: '#BDCEB7',
  card: '#182017',
  onCard: '#F2F7EE',

  // Typography
  textPrimary: '#F2F7EE',
  textSecondary: '#A3B59D',
  textTertiary: '#6E8069',
  textDisabled: '#404E3C',
  textInverse: '#0F140E',

  // Borders & Dividers
  border: '#2A3827',
  borderFocus: '#7CD448',
  divider: '#202B1E',

  // Feedback & Status
  success: '#7CD448',
  onSuccess: '#0B2205',
  successContainer: '#17360E',
  warning: '#EAB308',
  onWarning: '#241A02',
  warningContainer: '#3B3004',
  error: '#EF4444',
  onError: '#FFFFFF',
  errorContainer: '#450A0A',
  info: '#38BDF8',
  onInfo: '#0C4A6E',
  infoContainer: '#075985',

  // Interactive & Form Inputs
  inputBackground: '#182017',
  inputBorder: '#2D3D2A',
  inputPlaceholder: '#6E8069',
  disabled: '#202B1E',
  onDisabled: '#6E8069',
  ripple: 'rgba(124, 212, 72, 0.16)',
  backdrop: 'rgba(0, 0, 0, 0.8)',
};
