import type { SetupRun } from '../../models/setup-run';
import type { SetupStep } from '../../models/setup-step';
import type { SetupSession } from '../../models/setup-session';

export type SetupStreamEventName = 'setup.run' | 'setup.step' | 'setup.log' | 'setup.summary' | 'setup.heartbeat';

export interface SetupStreamEvent<T extends Record<string, unknown>> {
  event: SetupStreamEventName;
  runId: string;
  timestamp: string;
  data: T;
}

export type SetupStreamListener = (event: SetupStreamEvent<Record<string, unknown>>) => void;

export class SetupStreamService {
  private readonly listenersByRunId = new Map<string, Set<SetupStreamListener>>();
  private readonly historyByRunId = new Map<string, Array<SetupStreamEvent<Record<string, unknown>>>>();

  subscribe(runId: string, listener: SetupStreamListener): () => void {
    const listeners = this.listenersByRunId.get(runId) ?? new Set<SetupStreamListener>();
    listeners.add(listener);
    this.listenersByRunId.set(runId, listeners);

    const history = this.historyByRunId.get(runId) ?? [];
    for (const event of history) {
      listener(event);
    }

    return () => {
      const current = this.listenersByRunId.get(runId);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) {
        this.listenersByRunId.delete(runId);
      }
    };
  }

  publish<T extends Record<string, unknown>>(event: SetupStreamEvent<T>): void {
    const history = this.historyByRunId.get(event.runId) ?? [];
    history.push(event as SetupStreamEvent<Record<string, unknown>>);
    this.historyByRunId.set(event.runId, history.slice(-200));

    const listeners = this.listenersByRunId.get(event.runId);
    if (!listeners) return;
    for (const listener of listeners) {
      listener(event as SetupStreamEvent<Record<string, unknown>>);
    }
  }

  buildEvent<T extends Record<string, unknown>>(runId: string, name: SetupStreamEventName, data: T): SetupStreamEvent<T> {
    return {
      event: name,
      runId,
      timestamp: new Date().toISOString(),
      data,
    };
  }

  publishRun(run: SetupRun, extra?: { session?: SetupSession; steps?: SetupStep[] }): void {
    this.publish(this.buildEvent(run.runId, 'setup.run', {
      run,
      session: extra?.session,
      steps: extra?.steps,
    }));
  }

  publishStep(runId: string, step: SetupStep): void {
    this.publish(this.buildEvent(runId, 'setup.step', { step }));
  }

  publishLog(runId: string, stepKey: string, message: string): void {
    this.publish(this.buildEvent(runId, 'setup.log', { stepKey, message }));
  }

  publishSummary(runId: string, summary: string, errorSummary: string | null): void {
    this.publish(this.buildEvent(runId, 'setup.summary', { summary, errorSummary }));
  }
}
