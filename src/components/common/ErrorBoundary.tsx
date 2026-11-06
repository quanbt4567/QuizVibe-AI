import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('QuizVibe ErrorBoundary caught an unhandled render error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-border-tactile bg-card p-6 shadow-xl text-center space-y-5 animate-fadeIn">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <AlertTriangle className="h-7 w-7" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Đã xảy ra sự cố không mong muốn
              </h1>
              <p className="text-xs text-content-secondary leading-relaxed">
                Hệ thống đã ghi nhận lỗi này và đang tự động phục hồi. Bạn có thể thử tải lại trang hoặc bắt đầu lại.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <Button
                variant="outline"
                className="flex-1 justify-center gap-2 border-border-tactile hover:bg-surface"
                onClick={this.handleReset}
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Thử lại</span>
              </Button>
              <Button
                variant="default"
                className="flex-1 justify-center gap-2"
                onClick={this.handleReload}
              >
                <RefreshCw className="w-4 h-4" />
                <span>Tải lại trang</span>
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
