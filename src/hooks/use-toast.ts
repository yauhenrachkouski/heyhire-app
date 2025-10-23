import { toast as sonnerToast } from "sonner";

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}

export function useToast() {
  return {
    toast: (options: ToastOptions) => {
      const { title, description, variant } = options;
      const message = title
        ? description
          ? `${title}: ${description}`
          : title
        : description;

      if (variant === "destructive") {
        sonnerToast.error(message);
      } else {
        sonnerToast(message);
      }
    },
  };
}
