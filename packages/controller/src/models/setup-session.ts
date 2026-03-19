export type SetupTopLevelStatus =
  | 'draft'
  | 'ready'
  | 'running'
  | 'success'
  | 'partial_success'
  | 'failed'
  | 'cancelled';

export interface SetupSession {
  sessionId: string;
  status: SetupTopLevelStatus;
  topology: string;
  formData: Record<string, unknown> | null;
  manifestPreview: string | null;
  createdAt: Date;
  updatedAt: Date;
}
