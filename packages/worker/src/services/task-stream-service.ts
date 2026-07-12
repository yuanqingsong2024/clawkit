import type { WorkerConfig } from '../config';

export class TaskStreamService {
  private eventSource?: EventSource;
  private reconnectTimer?: NodeJS.Timeout;
  private isRunning = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly baseReconnectDelay = 1000;
  private readonly maxReconnectDelay = 60000;

  constructor(
    private config: WorkerConfig,
    private onTaskAvailable: () => void,
  ) {}

  start(): void {
    if (this.isRunning) {
      console.warn('任务流服务已在运行中');
      return;
    }

    this.isRunning = true;
    this.connect();
  }

  stop(): void {
    this.isRunning = false;
    this.reconnectAttempts = 0;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
    }

    console.log('任务流服务已停止');
  }

  private connect(): void {
    if (!this.isRunning) {
      return;
    }

    const url = `${this.config.controllerUrl}/api/workers/${this.config.workerId}/task-stream`;
    console.log(`连接任务流: ${url}`);

    try {
      let EventSourceImpl: any;
      if (typeof EventSource !== 'undefined') {
        EventSourceImpl = EventSource;
      } else {
        const eventsourceModule = require('eventsource');
        EventSourceImpl = eventsourceModule.EventSource || eventsourceModule;
      }

      const eventSource = new EventSourceImpl(url);
      this.eventSource = eventSource;

      eventSource.onopen = () => {
        console.log('任务流连接成功');
        this.reconnectAttempts = 0;
      };

      eventSource.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'task-available') {
            console.log('收到任务通知');
            this.onTaskAvailable();
          }
        } catch (error) {
          console.error('解析任务通知失败:', error);
        }
      };

      eventSource.onerror = (error: Event) => {
        console.error('任务流连接错误:', error);
        
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = undefined;
        }

        this.scheduleReconnect();
      };
    } catch (error) {
      console.error('创建任务流连接失败:', error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`任务流重连失败次数过多（${this.maxReconnectAttempts}），停止重连`);
      this.isRunning = false;
      return;
    }

    this.reconnectAttempts++;
    
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay,
    );

    console.log(`${delay}ms 后尝试重连任务流（第 ${this.reconnectAttempts} 次）`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }
}
