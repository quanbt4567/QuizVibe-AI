import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Enable React 19 act environment flag in Happy-DOM
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from './index';

describe('Phase 1: Design System Foundation — UI Primitives', () => {
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
  });

  const renderComponent = async (element: React.ReactElement) => {
    await act(async () => {
      root.render(element);
    });
    return container;
  };

  describe('1. Button Component', () => {
    it('renders with default variant and size', async () => {
      await renderComponent(<Button>Click me</Button>);
      const btn = container.querySelector('button');
      expect(btn).not.toBeNull();
      expect(btn?.textContent).toBe('Click me');
      expect(btn?.className).toContain('bg-primary');
      expect(btn?.className).toContain('h-10');
      expect(btn?.className).toContain('leading-snug');
    });

    it('renders different visual variants correctly', async () => {
      await renderComponent(<Button variant="destructive">Delete</Button>);
      let btn = container.querySelector('button');
      expect(btn?.className).toContain('bg-destructive');

      await renderComponent(<Button variant="outline">Outline</Button>);
      btn = container.querySelector('button');
      expect(btn?.className).toContain('border-border-subtle');

      await renderComponent(<Button variant="secondary">Secondary</Button>);
      btn = container.querySelector('button');
      expect(btn?.className).toContain('bg-secondary');

      await renderComponent(<Button variant="success">Success</Button>);
      btn = container.querySelector('button');
      expect(btn?.className).toContain('bg-success');

      await renderComponent(<Button variant="ghost">Ghost</Button>);
      btn = container.querySelector('button');
      expect(btn?.className).toContain('hover:bg-interactive');
    });

    it('supports player-first touch target size="lg" (h-12 / 48px) and tactile 3D variants', async () => {
      await renderComponent(
        <Button variant="tactile-primary" size="lg">
          Bắt đầu thử thách
        </Button>
      );
      const btn = container.querySelector('button');
      expect(btn?.className).toContain('h-12');
      expect(btn?.className).toContain('rounded-xl');
      expect(btn?.className).toContain('border-b-4');
      expect(btn?.className).toContain('active:translate-y-[2px]');
    });

    it('shows loading spinner and disables button when isLoading=true', async () => {
      await renderComponent(<Button isLoading>Generating...</Button>);
      const btn = container.querySelector('button');
      expect(btn?.disabled).toBe(true);
      expect(btn?.querySelector('.animate-spin')).not.toBeNull();
    });

    it('triggers onClick handler when clicked', async () => {
      const handleClick = vi.fn();
      await renderComponent(<Button onClick={handleClick}>Submit</Button>);
      const btn = container.querySelector('button');
      act(() => {
        btn?.click();
      });
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. Badge Component', () => {
    it('renders with default variant', async () => {
      await renderComponent(<Badge>Default Badge</Badge>);
      const badge = container.querySelector('div');
      expect(badge?.textContent).toBe('Default Badge');
      expect(badge?.className).toContain('rounded-full');
      expect(badge?.className).toContain('bg-primary/15');
    });

    it('renders semantic status variants (success, warning, destructive, muted) and tabularNums', async () => {
      await renderComponent(<Badge variant="success">Active</Badge>);
      let badge = container.querySelector('div');
      expect(badge?.className).toContain('text-emerald-300');

      await renderComponent(<Badge variant="warning" tabularNums>#1</Badge>);
      badge = container.querySelector('div');
      expect(badge?.className).toContain('text-amber-300');
      expect(badge?.className).toContain('tabular-nums');

      await renderComponent(<Badge variant="destructive">Quota Exceeded</Badge>);
      badge = container.querySelector('div');
      expect(badge?.className).toContain('text-rose-300');

      await renderComponent(<Badge variant="muted" shape="compact">v1.0</Badge>);
      badge = container.querySelector('div');
      expect(badge?.className).toContain('rounded-md');
      expect(badge?.className).toContain('text-content-muted');
    });
  });

  describe('3. Card Component & Sub-components', () => {
    it('renders a full structured card and supports surface variants', async () => {
      await renderComponent(
        <Card data-testid="test-card">
          <CardHeader>
            <CardTitle>Campaign Overview</CardTitle>
            <CardDescription>Real-time analytics summary</CardDescription>
          </CardHeader>
          <CardContent>
            <p>150 leads collected</p>
          </CardContent>
          <CardFooter>
            <button>View Details</button>
          </CardFooter>
        </Card>
      );

      const card = container.querySelector('[data-testid="test-card"]');
      expect(card).not.toBeNull();
      expect(card?.className).toContain('rounded-xl');
      expect(card?.className).toContain('border-border');
      expect(card?.className).toContain('bg-card');

      expect(container.textContent).toContain('Campaign Overview');
      expect(container.textContent).toContain('Real-time analytics summary');
      expect(container.textContent).toContain('150 leads collected');
      expect(container.textContent).toContain('View Details');

      await renderComponent(<Card data-testid="player-card" variant="player">Question</Card>);
      const playerCard = container.querySelector('[data-testid="player-card"]');
      expect(playerCard?.className).toContain('border-border-tactile');
    });
  });

  describe('4. Input Component', () => {
    it('renders input with default styling, player variant, and tabularNums', async () => {
      const handleChange = vi.fn();
      await renderComponent(<Input placeholder="Nhập họ tên" onChange={handleChange} />);
      let input = container.querySelector('input');

      expect(input).not.toBeNull();
      expect(input?.className).toContain('border-input');
      expect(input?.className).toContain('bg-recessed');
      expect(input?.className).toContain('h-10');
      expect(input?.placeholder).toBe('Nhập họ tên');

      await renderComponent(<Input variant="player" tabularNums placeholder="0901234567" />);
      input = container.querySelector('input');
      expect(input?.className).toContain('h-12');
      expect(input?.className).toContain('tabular-nums');
    });

    it('respects disabled attribute', async () => {
      await renderComponent(<Input disabled placeholder="Disabled field" />);
      const input = container.querySelector('input');
      expect(input?.disabled).toBe(true);
      expect(input?.className).toContain('disabled:opacity-50');
    });
  });

  describe('5. Table Component & Sub-components', () => {
    it('renders semantic table hierarchy with tabularNums support', async () => {
      await renderComponent(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hạng</TableHead>
              <TableHead>Họ tên</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell tabularNums>#1</TableCell>
              <TableCell>Trần Thị B</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );

      expect(container.querySelector('table')).not.toBeNull();
      expect(container.querySelector('th')?.textContent).toBe('Hạng');
      const firstCell = container.querySelector('td');
      expect(firstCell?.textContent).toBe('#1');
      expect(firstCell?.className).toContain('tabular-nums');
      expect(container.textContent).toContain('Trần Thị B');
    });
  });

  describe('6. Tabs Component (Segmented Navigation)', () => {
    it('switches content when tab triggers are clicked in uncontrolled mode', async () => {
      await renderComponent(
        <Tabs defaultValue="manual">
          <TabsList>
            <TabsTrigger value="manual">Biên tập thủ công</TabsTrigger>
            <TabsTrigger value="ai">Trợ lý AI</TabsTrigger>
            <TabsTrigger value="leads">Quản lý Lead</TabsTrigger>
          </TabsList>
          <TabsContent value="manual">Nội dung Biên tập</TabsContent>
          <TabsContent value="ai">Nội dung AI Studio</TabsContent>
          <TabsContent value="leads">Nội dung Lead Table</TabsContent>
        </Tabs>
      );

      expect(container.textContent).toContain('Nội dung Biên tập');
      expect(container.textContent).not.toContain('Nội dung AI Studio');

      // Click second tab
      const buttons = container.querySelectorAll('button');
      act(() => {
        buttons[1].click();
      });
      expect(container.textContent).not.toContain('Nội dung Biên tập');
      expect(container.textContent).toContain('Nội dung AI Studio');

      // Click third tab
      act(() => {
        buttons[2].click();
      });
      expect(container.textContent).not.toContain('Nội dung AI Studio');
      expect(container.textContent).toContain('Nội dung Lead Table');
    });

    it('works cleanly in controlled mode and calls onValueChange', async () => {
      const handleValueChange = vi.fn();
      await renderComponent(
        <Tabs value="leads" onValueChange={handleValueChange}>
          <TabsList>
            <TabsTrigger value="manual">Biên tập</TabsTrigger>
            <TabsTrigger value="leads">Leads</TabsTrigger>
          </TabsList>
          <TabsContent value="manual">Manual Pane</TabsContent>
          <TabsContent value="leads">Leads Pane</TabsContent>
        </Tabs>
      );

      expect(container.textContent).toContain('Leads Pane');
      expect(container.textContent).not.toContain('Manual Pane');

      const buttons = container.querySelectorAll('button');
      act(() => {
        buttons[0].click();
      });
      expect(handleValueChange).toHaveBeenCalledWith('manual');
    });
  });
});
