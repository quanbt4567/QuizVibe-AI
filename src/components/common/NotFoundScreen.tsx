import React from 'react';
import { Compass, ArrowLeft } from 'lucide-react';
import { Button, Card } from '../ui';

export interface NotFoundScreenProps {
  pathname: string;
  area: 'admin' | 'public';
  onReturnHome: () => void;
  title?: string;
  description?: string;
  ctaLabel?: string;
}

/**
 * Not-Found / Unavailable Route State
 * Public view contains zero Admin navigation or management links.
 */
export const NotFoundScreen: React.FC<NotFoundScreenProps> = ({
  pathname,
  area,
  onReturnHome,
  title,
  description,
  ctaLabel,
}) => {
  const resolvedTitle =
    title ||
    (area === 'admin'
      ? 'Không tìm thấy trang quản trị'
      : 'Không tìm thấy trang hoặc chiến dịch');

  const resolvedDesc =
    description ||
    (area === 'admin'
      ? `Đường dẫn quản trị "${pathname}" không tồn tại trong hệ thống.`
      : `Đường dẫn "${pathname}" không tồn tại hoặc chiến dịch minigame này chưa được xuất bản.`);

  const resolvedCta =
    ctaLabel ||
    (area === 'admin' ? 'Quay lại Tổng quan Quản trị' : 'Quay lại Trang chủ Minigame');

  return (
    <div
      data-testid="not-found-screen"
      className="mx-auto w-full max-w-md px-4 py-12"
    >
      <Card
        variant={area === 'public' ? 'player' : 'default'}
        className="p-6 sm:p-8 text-center space-y-5"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-border-subtle bg-recessed text-primary">
          <Compass className="h-6 w-6" />
        </div>

        <div className="space-y-2">
          <p className="font-mono text-xs font-semibold text-primary">404 • NOT FOUND</p>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {resolvedTitle}
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary leading-relaxed">
            {resolvedDesc}
          </p>
        </div>

        <div className="pt-2">
          <Button
            type="button"
            variant={area === 'public' ? 'tactile-primary' : 'default'}
            size={area === 'public' ? 'lg' : 'default'}
            onClick={onReturnHome}
            className="w-full gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{resolvedCta}</span>
          </Button>
        </div>
      </Card>
    </div>
  );
};

