export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  // Brand / Primary
  primary: string;
  primaryVariant: string;
  onPrimary: string;
  secondary: string;
  secondaryVariant: string;
  onSecondary: string;

  // Background & Surfaces
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  card: string;
  onCard: string;

  // Typography
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textDisabled: string;
  textInverse: string;

  // Borders & Dividers
  border: string;
  borderFocus: string;
  divider: string;

  // Feedback & Status
  success: string;
  onSuccess: string;
  successContainer: string;
  warning: string;
  onWarning: string;
  warningContainer: string;
  error: string;
  onError: string;
  errorContainer: string;
  info: string;
  onInfo: string;
  infoContainer: string;

  // Interactive & Form Inputs
  inputBackground: string;
  inputBorder: string;
  inputPlaceholder: string;
  disabled: string;
  onDisabled: string;
  ripple: string;
  backdrop: string;
}

export interface Spacing {
  none: number;
  xxs: number;
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
  xxxl: number;
}

export interface BorderRadius {
  none: number;
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  full: number;
}

export interface TypographyStyle {
  fontSize: number;
  lineHeight: number;
  fontWeight: '400' | '500' | '600' | '700' | '800';
  letterSpacing?: number;
}

export interface Typography {
  h1: TypographyStyle;
  h2: TypographyStyle;
  h3: TypographyStyle;
  h4: TypographyStyle;
  subtitle1: TypographyStyle;
  subtitle2: TypographyStyle;
  body1: TypographyStyle;
  body2: TypographyStyle;
  button: TypographyStyle;
  caption: TypographyStyle;
  overline: TypographyStyle;
}

export interface Theme {
  isDark: boolean;
  colors: ThemeColors;
  spacing: Spacing;
  borderRadius: BorderRadius;
  typography: Typography;
}

export interface ThemeContextType {
  theme: Theme;
  colors: ThemeColors;
  spacing: Spacing;
  borderRadius: BorderRadius;
  typography: Typography;
  themeMode: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}
