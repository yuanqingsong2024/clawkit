/**
 * Card 组件测试
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from '../../src/components/ui/Card';

describe('Card 组件', () => {
  it('应正确渲染标题和内容', () => {
    render(
      <Card title="测试标题">
        <p>测试内容</p>
      </Card>
    );
    
    expect(screen.getByText('测试标题')).toBeTruthy();
    expect(screen.getByText('测试内容')).toBeTruthy();
  });

  it('应支持 compact 属性', () => {
    const { container } = render(
      <Card title="紧凑卡片" compact>
        <p>紧凑内容</p>
      </Card>
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('应支持 children 为空', () => {
    const { container } = render(<Card title="无内容卡片" />);
    expect(container.firstChild).toBeTruthy();
  });
});
