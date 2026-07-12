/**
 * Setup Stream 服务
 * 
 * 处理 Setup 向导的流式输出（SSE）
 */
export interface StreamEvent {
  type: string;
  data: unknown;
  timestamp?: number;
}

export class SetupStreamService {
  private streams: Map<string, (event: StreamEvent) => void> = new Map();

  constructor() {
    // 初始化流服务
  }

  /**
   * 注册流处理器
   */
  registerStream(id: string, handler: (event: StreamEvent) => void): void {
    this.streams.set(id, handler);
  }

  /**
   * 注销流处理器
   */
  unregisterStream(id: string): void {
    this.streams.delete(id);
  }

  /**
   * 发送事件
   */
  sendEvent(id: string, event: StreamEvent): void {
    const handler = this.streams.get(id);
    if (handler) {
      handler(event);
    }
  }

  /**
   * 广播事件到所有流
   */
  broadcastEvent(event: StreamEvent): void {
    for (const handler of this.streams.values()) {
      handler(event);
    }
  }

  /**
   * 创建 SSE 格式的事件
   */
  formatSSE(event: StreamEvent): string {
    return `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
  }
}

export default SetupStreamService;
