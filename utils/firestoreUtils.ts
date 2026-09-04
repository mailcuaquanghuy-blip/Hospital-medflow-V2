
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
}

type QuotaListener = (isExceeded: boolean) => void;
const quotaListeners: Set<QuotaListener> = new Set();
export let isQuotaExceededState = false;

export const subscribeQuotaExceeded = (listener: QuotaListener) => {
  quotaListeners.add(listener);
  if (isQuotaExceededState) {
    listener(true);
  }
  return () => {
    quotaListeners.delete(listener);
  };
};

export const checkIsQuotaError = (error: any): boolean => {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.toLowerCase().includes('quota limit exceeded') ||
    msg.toLowerCase().includes('quota exceeded') ||
    msg.toLowerCase().includes('resource_exhausted') ||
    msg.toLowerCase().includes('free daily read units')
  );
};

export const handleFirestoreError = (error: any, operationType: OperationType, path: string | null) => {
  if (checkIsQuotaError(error)) {
    console.warn(`[Database Quota Exceeded] ${operationType} on path: ${path}`);
    if (!isQuotaExceededState) {
      isQuotaExceededState = true;
      quotaListeners.forEach(l => l(true));
    }
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  };
  console.error('Database Error: ', JSON.stringify(errInfo));
};

