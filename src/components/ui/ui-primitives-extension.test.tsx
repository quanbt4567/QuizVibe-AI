import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StatCard } from './stat-card';
import { EmptyState } from './empty-state';
import { SearchInput, InputGroup, InputAddon } from './input-group';
import { Award, Users } from 'lucide-react';

// @ts-expect-error react act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('Extended UI Primitives: StatCard, EmptyState, InputGroup', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  describe('StatCard', () => {
    it('renders title, formatted numeric value, and icon', async () => {
      await act(async () => {
        root.render(
          <StatCard
            title="Tổng số Lead"
            value="1.248"
            icon={<Users data-testid="users-icon" className="w-4 h-4" />}
            subtitle="Cập nhật 5 phút trước"
          />
        );
      });

      expect(container.textContent).toContain('Tổng số Lead');
      expect(container.textContent).toContain('1.248');
      expect(container.textContent).toContain('Cập nhật 5 phút trước');
      expect(container.querySelector('[data-testid="users-icon"]')).toBeTruthy();
    });

    it('renders positive trend pill with up direction correctly', async () => {
      await act(async () => {
        root.render(
          <StatCard
            title="Tỷ lệ chuyển đổi"
            value="34.2%"
            trend={{ value: '+4.8%', direction: 'up', label: 'so với tuần trước' }}
          />
        );
      });

      expect(container.textContent).toContain('+4.8%');
      expect(container.textContent).toContain('so với tuần trước');
      const trendEl = container.querySelector('.text-emerald-300');
      expect(trendEl).toBeTruthy();
    });

    it('handles click and keyboard Enter triggers when onClick is provided', async () => {
      const handleClick = vi.fn();

      await act(async () => {
        root.render(
          <StatCard
            title="Clickable Metric"
            value="500"
            onClick={handleClick}
          />
        );
      });

      const cardBtn = container.querySelector('[role="button"]') as HTMLElement;
      expect(cardBtn).toBeTruthy();

      await act(async () => {
        cardBtn.click();
      });
      expect(handleClick).toHaveBeenCalledTimes(1);

      // Press Enter key
      await act(async () => {
        cardBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      });
      expect(handleClick).toHaveBeenCalledTimes(2);
    });
  });

  describe('EmptyState', () => {
    it('renders icon, title, description, and primary action button', async () => {
      const handleAction = vi.fn();

      await act(async () => {
        root.render(
          <EmptyState
            title="Chưa có khách hàng đăng ký"
            description="Hãy chia sẻ chiến dịch lên Fanpage hoặc Facebook để thu hút người chơi!"
            icon={<Award data-testid="award-icon" className="w-6 h-6" />}
            action={{
              label: 'Chia sẻ ngay',
              onClick: handleAction,
            }}
          />
        );
      });

      expect(container.textContent).toContain('Chưa có khách hàng đăng ký');
      expect(container.textContent).toContain('Hãy chia sẻ chiến dịch');
      expect(container.querySelector('[data-testid="award-icon"]')).toBeTruthy();

      const btn = container.querySelector('button');
      expect(btn?.textContent).toContain('Chia sẻ ngay');

      await act(async () => {
        btn?.click();
      });
      expect(handleAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('SearchInput & InputGroup', () => {
    it('renders input, displays clear button when text is entered, and handles clear', async () => {
      const handleChange = vi.fn();
      const handleClear = vi.fn();

      await act(async () => {
        root.render(
          <SearchInput
            value="Nguyễn Văn A"
            onChange={handleChange}
            onClear={handleClear}
            placeholder="Tìm theo tên..."
            shortcutBadge="⌘K"
          />
        );
      });

      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.value).toBe('Nguyễn Văn A');

      // Clear button should be present
      const clearBtn = container.querySelector('button[aria-label="Xoá tìm kiếm"]') as HTMLButtonElement;
      expect(clearBtn).toBeTruthy();

      await act(async () => {
        clearBtn.click();
      });

      expect(handleChange).toHaveBeenCalledWith('');
      expect(handleClear).toHaveBeenCalledTimes(1);
    });

    it('renders shortcut badge when input is empty and shortcutBadge prop is passed', async () => {
      await act(async () => {
        root.render(
          <SearchInput
            value=""
            onChange={() => {}}
            shortcutBadge="⌘K"
          />
        );
      });

      const kbd = container.querySelector('kbd');
      expect(kbd?.textContent).toBe('⌘K');
    });

    it('renders InputGroup with InputAddon smoothly', async () => {
      await act(async () => {
        root.render(
          <InputGroup>
            <InputAddon placement="left">
              <span data-testid="addon-left">VND</span>
            </InputAddon>
            <input className="pl-12" defaultValue="50000" />
          </InputGroup>
        );
      });

      expect(container.querySelector('[data-testid="addon-left"]')).toBeTruthy();
      expect(container.textContent).toContain('VND');
    });
  });
});
