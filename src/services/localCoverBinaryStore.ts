import type { LocalCoverAssetBackend } from '../types/localCover';

// src/services/localCoverBinaryStore.ts
// The local library is gone. Cover bytes are no longer stored.

export interface LocalCoverBinaryWriteResult {
    backend: LocalCoverAssetBackend;
    mimeType: string;
    size: number;
}

export const isValidLocalCoverAssetId = (value: unknown): value is string => (
    typeof value === 'string' && /^[a-zA-Z0-9_-]{8,}$/.test(value)
);

export const normalizeLocalCoverMimeType = (value: unknown): string | null => (
    typeof value === 'string' && value.toLowerCase().startsWith('image/') ? value.toLowerCase() : null
);

export const isLocalCoverWebRuntimeSupported = (): boolean => false;

export const isLocalCoverAssetRuntimeSupported = (): boolean => false;

export const hasLocalCoverBinary = async (_assetId: string): Promise<boolean> => false;

export const writeLocalCoverBinary = async (
    _assetId: string,
    _value: unknown,
): Promise<LocalCoverBinaryWriteResult | null> => null;

export const removeLocalCoverBinary = async (_assetId: string): Promise<void> => {};

export const clearLocalCoverBinaries = async (): Promise<void> => {};
