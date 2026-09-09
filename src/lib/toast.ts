import { toast as reactToast, ToastOptions } from "react-toastify";

export const toast = {
  success: (message: string, options?: ToastOptions) =>
    reactToast.success(message, options),
  error: (message: string, options?: ToastOptions) =>
    reactToast.error(message, options),
  info: (message: string, options?: ToastOptions) =>
    reactToast.info(message, options),
  warning: (message: string, options?: ToastOptions) =>
    reactToast.warning(message, options),
};

export { reactToast };
