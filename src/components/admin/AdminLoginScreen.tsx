import React, { useState } from 'react';
import { Lock, ShieldCheck, AlertCircle, ArrowLeft, Layers } from 'lucide-react';
import { loginAdmin } from '../../services/adminAuthService';
import { Button, Card, Input, Badge } from '../ui';

export interface AdminLoginScreenProps {
  onLoginSuccess: (expiresAt?: string) => void;
  onNavigatePublicQuiz?: () => void;
  initialError?: string | null;
}

/**
 * Dedicated Admin Login Screen (/admin/login)
 * Authenticates via server-side `POST /api/admin/login` (HttpOnly cookie).
 * Never persists passwords or tokens in localStorage or sessionStorage.
 */
export const AdminLoginScreen: React.FC<AdminLoginScreenProps> = ({
  onLoginSuccess,
  onNavigatePublicQuiz,
  initialError = null,
}) => {
  const [password, setPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMessage('Vui lòng nhập mật khẩu Quản trị viên.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await loginAdmin(password);
    setIsSubmitting(false);

    if (result.ok && result.authenticated) {
      setPassword('');
      onLoginSuccess(result.expiresAt);
      return;
    }

    setErrorMessage(result.error || 'Mật khẩu Quản trị viên không chính xác.');
  };

  return (
    <div
      data-testid="admin-login-screen"
      className="min-h-screen bg-canvas text-foreground flex flex-col justify-between font-sans px-4 py-8"
    >
      <div className="mx-auto w-full max-w-md flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/30 bg-primary/15 text-primary shadow-key">
            <Layers className="h-4 w-4" />
          </div>
          <span className="text-sm sm:text-base font-bold tracking-tight text-foreground">
            QuizVibe <span className="text-primary">AI</span>
          </span>
          <Badge variant="default" shape="compact" className="font-mono text-[10px]">
            STUDIO
          </Badge>
        </div>

        {onNavigatePublicQuiz && (
          <button
            type="button"
            onClick={onNavigatePublicQuiz}
            className="inline-flex items-center gap-1.5 text-xs text-content-secondary hover:text-foreground transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Trang người chơi</span>
          </button>
        )}
      </div>

      <div className="mx-auto w-full max-w-md my-auto py-8">
        <Card className="p-6 sm:p-8 space-y-6 border-border-subtle shadow-elevated">
          <div className="space-y-2">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
              <Lock className="h-5 w-5" />
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Đăng nhập Quản trị viên
            </h1>
            <p className="text-xs sm:text-sm text-content-secondary leading-relaxed">
              Khu vực dành riêng cho Quản trị viên biên tập chiến dịch, cấu hình voucher và quản lý danh sách khách hàng tiềm năng.
            </p>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-xs sm:text-sm text-rose-200"
            >
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="admin-password-input"
                className="block text-xs font-medium text-content-secondary mb-1.5"
              >
                Mật khẩu Quản trị <span className="text-destructive">*</span>
              </label>
              <Input
                id="admin-password-input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu quản trị..."
                disabled={isSubmitting}
              />
            </div>

            <Button
              type="submit"
              variant="default"
              isLoading={isSubmitting}
              className="w-full font-semibold"
            >
              {isSubmitting ? 'Đang xác thực...' : 'Đăng nhập vào Admin Studio'}
            </Button>
          </form>

          <div className="flex items-center gap-2 pt-3 border-t border-border-subtle text-[11px] text-content-muted">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Phiên đăng nhập được bảo vệ bằng HttpOnly Cookie phía máy chủ.</span>
          </div>
        </Card>
      </div>

      <footer className="text-center text-xs text-content-muted">
        <p>QuizVibe AI Studio &copy; 2026</p>
      </footer>
    </div>
  );
};

