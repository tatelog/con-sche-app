import { toast } from "sonner";

export function showError(error: unknown): void {
  if (error && typeof error === "object" && "userMessage" in error) {
    toast.error((error as any).userMessage);
  } else if (error instanceof Error) {
    toast.error(error.message);
  } else {
    toast.error("予期しないエラーが発生しました");
  }
}

export function showSuccess(message: string): void {
  toast.success(message);
}
