import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '../../src/components/ui/Modal';

describe('Modal 组件', () => {
  const defaultProps = {
    isOpen: false,
    onClose: vi.fn(),
    title: '测试弹窗',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('isOpen 为 false 时不应该渲染', () => {
    render(
      <Modal {...defaultProps} isOpen={false}>
        <div>弹窗内容</div>
      </Modal>
    );
    expect(screen.queryByText('弹窗内容')).not.toBeInTheDocument();
  });

  it('isOpen 为 true 时应该渲染内容', () => {
    render(
      <Modal {...defaultProps} isOpen={true}>
        <div>弹窗内容</div>
      </Modal>
    );
    expect(screen.getByText('弹窗内容')).toBeInTheDocument();
  });

  it('应该显示标题', () => {
    render(
      <Modal {...defaultProps} isOpen={true} title="自定义标题">
        <div>内容</div>
      </Modal>
    );
    expect(screen.getByText('自定义标题')).toBeInTheDocument();
  });

  it('点击关闭按钮应该调用 onClose', async () => {
    const user = userEvent.setup();
    render(
      <Modal {...defaultProps} isOpen={true}>
        <div>内容</div>
      </Modal>
    );

    await user.click(screen.getByLabelText('关闭'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('应该应用不同的 size', () => {
    const { rerender } = render(
      <Modal {...defaultProps} isOpen={true} size="sm">
        <div>小弹窗</div>
      </Modal>
    );
    expect(screen.getByText('小弹窗')).toBeInTheDocument();

    rerender(
      <Modal {...defaultProps} isOpen={true} size="lg">
        <div>大弹窗</div>
      </Modal>
    );
    expect(screen.getByText('大弹窗')).toBeInTheDocument();
  });

  it('应该显示 ESC 提示', () => {
    render(
      <Modal {...defaultProps} isOpen={true}>
        <div>内容</div>
      </Modal>
    );
    expect(screen.getByText('按 ESC 可关闭')).toBeInTheDocument();
  });
});
