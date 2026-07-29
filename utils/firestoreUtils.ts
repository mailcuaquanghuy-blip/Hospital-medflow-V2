
import { auth } from '../firebase';

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
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
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
    console.warn(`[Firestore Quota Exceeded] ${operationType} on path: ${path}`);
    if (!isQuotaExceededState) {
      isQuotaExceededState = true;
      quotaListeners.forEach(l => l(true));
    }
    // Return gracefully without throwing uncaught exceptions
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

