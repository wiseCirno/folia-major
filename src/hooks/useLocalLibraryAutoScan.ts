import type { LocalLibraryAutoScanState } from '../types/localLibraryWatch';

// src/hooks/useLocalLibraryAutoScan.ts
// The local library is gone, so nothing watches imported folders.

const idleAutoScanState: LocalLibraryAutoScanState = {
    supported: false,
    enabled: false,
    scanning: false,
    attaching: false,
    roots: [],
    lastScanAt: null,
    lastScanRootFolderName: null,
    lastError: null,
};

/** Call once, from the app root. */
export const useLocalLibraryAutoScan = (): void => {};

export const useLocalLibraryAutoScanState = (): LocalLibraryAutoScanState => idleAutoScanState;
