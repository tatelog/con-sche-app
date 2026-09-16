import { Component, ReactNode } from "react";
import { showError } from "@/lib/toast";
import { reportError } from "@/lib/errorReporter";

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    showError(error);
    // 画面が落ちたことだけは必ず残す（利用者からの申告を待たない）
    reportError(error, "react", API_BASE);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center p-8">
            <h2 className="text-xl font-bold text-gray-800 mb-2">エラーが発生しました</h2>
            <p className="text-gray-600 mb-4">ページを再読み込みしてください</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              再読み込み
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
