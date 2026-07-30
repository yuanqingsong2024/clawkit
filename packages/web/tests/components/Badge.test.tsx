/**
 * Badge 组件测试
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../../src/components/ui/Badge';

describe('Badge 组件', () => {
  it('应正确渲染文本内容', () => {
    render(<Badge tone="neutral">测试文本</Badge>);
    expect(screen.getByText('测试文本')).toBeTruthy();
  });

  it('应支持不同的 tone 属性', () => {
    const tones: Array<'neutral' | 'info' | 'warning' | 'failed' | 'success'> = [
      'neutral', 'info', 'warning', 'failed', 'success'
    ];
    
    tones.forEach(tone => {
      const { container } = render(<Badge tone={tone}>{tone}</Badge>);
      expect(container.firstChild).toBeTruthy();
    });
  });

  it('应支持 className 覆盖', () => {
    const { container } = render(
      <Badge tone="neutral" className="custom-class">自定义样式</Badge>
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
