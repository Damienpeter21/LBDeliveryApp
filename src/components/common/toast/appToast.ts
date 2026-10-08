import Toast from 'react-native-toast-message';

export type AppToastType = 'success' | 'error' | 'warning' | 'info';

export type ShowAppToastOptions = {
  type: AppToastType;
  title: string;
  message?: string;
  visibilityTime?: number;
};

export const APP_TOAST_POSITION: 'top' | 'bottom' = 'top';

const DEFAULT_VISIBILITY_MS: Record<AppToastType, number> = {
  success: 3000,
  error: 4000,
  warning: 4000,
  info: 3500,
};

export const stripStatusCodeFromText = (text: string): string =>
  text
    .replace(/request failed with status code\s*\d+/gi, '')
    .replace(/\bstatus code\s*\d+\b/gi, '')
    .replace(/\s*\(\d{1,4}\)\s*/g, ' ')
    .replace(/^\s*\d{3}\s*[-:]\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

export const resolveToastDisplay = (
  title: string,
  message?: string,
): { text1: string } => {
  const detail = stripStatusCodeFromText(message?.trim() ?? '');

  if (detail) {
    return {
      text1: detail,
    };
  }

  return {
    text1: stripStatusCodeFromText(title.trim()),
  };
};

export const toastTypeFromStatusCode = (statusCode: number): AppToastType => {
  if (statusCode >= 200 && statusCode < 300) {
    return 'success';
  }

  if (statusCode >= 400) {
    return 'error';
  }

  return 'info';
};

const computeVisibilityTime = (
  type: AppToastType,
  text: string,
  override?: number,
): number => {
  if (override !== undefined) {
    return override;
  }

  const base = DEFAULT_VISIBILITY_MS[type];
  const charExtra = Math.floor(Math.max(0, text.length - 60) / 25) * 400;

  return Math.min(9000, base + charExtra);
};

export const showAppToast = ({
  type,
  title,
  message,
  visibilityTime,
}: ShowAppToastOptions): void => {
  const { text1 } = resolveToastDisplay(title, message);

  if (!text1) {
    return;
  }

  // Defer so GlobalAppLoader / navigation can settle before Toast mounts UI.
  setTimeout(() => {
    Toast.show({
      type,
      text1,
      position: APP_TOAST_POSITION,
      visibilityTime: computeVisibilityTime(type, text1, visibilityTime),
    });
  }, 50);
};

export const showSuccessToast = (
  title: string,
  message?: string,
  options?: Omit<ShowAppToastOptions, 'type' | 'title' | 'message'>,
): void => {
  showAppToast({
    type: 'success',
    title,
    message,
    ...options,
  });
};

export const showErrorToast = (
  title: string,
  message?: string,
  options?: Omit<ShowAppToastOptions, 'type' | 'title' | 'message'>,
): void => {
  showAppToast({
    type: 'error',
    title,
    message,
    ...options,
  });
};

export const showWarningToast = (
  title: string,
  message?: string,
  options?: Omit<ShowAppToastOptions, 'type' | 'title' | 'message'>,
): void => {
  showAppToast({
    type: 'warning',
    title,
    message,
    ...options,
  });
};

export const showInfoToast = (
  title: string,
  message?: string,
  options?: Omit<ShowAppToastOptions, 'type' | 'title' | 'message'>,
): void => {
  showAppToast({
    type: 'info',
    title,
    message,
    ...options,
  });
};

export const showStatusMessageToast = (
  statusCode: number,
  statusMessage?: string,
  fallbackMessage = 'Request failed.',
  visibilityTime?: number,
): void => {
  const text =
    stripStatusCodeFromText(statusMessage?.trim() ?? '') || fallbackMessage;

  showAppToast({
    type: toastTypeFromStatusCode(statusCode),
    title: text,
    visibilityTime,
  });
};

export const hideToast = (): void => {
  Toast.hide();
};
