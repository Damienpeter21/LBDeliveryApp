// src/components/common/StatusModalContext.tsx
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AlertDialog, AlertDialogOptions } from './AlertDialog';
import { StatusModalOptions } from './StatusModal';

interface AlertDialogContextType {
  showAlertDialog: (options: AlertDialogOptions) => void;
  hideAlertDialog: () => void;
  showStatusModal: (options: StatusModalOptions | AlertDialogOptions) => void;
  hideStatusModal: () => void;
}

const AlertDialogContext = createContext<AlertDialogContextType | undefined>(undefined);

// Global ref for non-hook / utility calls
let globalShowModal: ((options: AlertDialogOptions) => void) | null = null;
let globalHideModal: (() => void) | null = null;

export const AppAlert = {
  show: (options: AlertDialogOptions) => {
    if (globalShowModal) {
      globalShowModal(options);
    } else {
      console.warn('AlertDialogProvider / StatusModalProvider not mounted yet');
    }
  },
  success: (title: string, message: string, onConfirm?: () => void, buttonText?: string) => {
    AppAlert.show({
      type: 'success',
      title,
      message,
      onConfirm,
      buttonText,
    });
  },
  error: (title: string, message: string, onConfirm?: () => void, buttonText?: string) => {
    AppAlert.show({
      type: 'error',
      title,
      message,
      onConfirm,
      buttonText,
    });
  },
  warning: (title: string, message: string, onConfirm?: () => void, buttonText?: string) => {
    AppAlert.show({
      type: 'warning',
      title,
      message,
      onConfirm,
      buttonText,
    });
  },
  info: (title: string, message: string, onConfirm?: () => void, buttonText?: string) => {
    AppAlert.show({
      type: 'info',
      title,
      message,
      onConfirm,
      buttonText,
    });
  },
  confirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDestructive = false,
  ) => {
    AppAlert.show({
      type: 'confirm',
      title,
      message,
      onConfirm,
      onCancel,
      confirmText,
      cancelText,
      isDestructive,
    });
  },
  hide: () => {
    if (globalHideModal) {
      globalHideModal();
    }
  },
};

export const AlertDialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState<boolean>(false);
  const [modalOptions, setModalOptions] = useState<AlertDialogOptions | null>(null);

  const showAlertDialog = useCallback((options: AlertDialogOptions) => {
    setModalOptions(options);
    setVisible(true);
  }, []);

  const hideAlertDialog = useCallback(() => {
    setVisible(false);
  }, []);

  useEffect(() => {
    globalShowModal = showAlertDialog;
    globalHideModal = hideAlertDialog;
    return () => {
      globalShowModal = null;
      globalHideModal = null;
    };
  }, [showAlertDialog, hideAlertDialog]);

  return (
    <AlertDialogContext.Provider
      value={{
        showAlertDialog,
        hideAlertDialog,
        showStatusModal: showAlertDialog,
        hideStatusModal: hideAlertDialog,
      }}
    >
      {children}
      <AlertDialog
        visible={visible}
        options={modalOptions}
        onClose={hideAlertDialog}
      />
    </AlertDialogContext.Provider>
  );
};

// Aliases for seamless backward-compatibility
export const StatusModalProvider = AlertDialogProvider;

export const useAlertDialog = (): AlertDialogContextType => {
  const context = useContext(AlertDialogContext);
  if (!context) {
    throw new Error('useAlertDialog must be used within an AlertDialogProvider');
  }
  return context;
};

export const useStatusModal = useAlertDialog;
