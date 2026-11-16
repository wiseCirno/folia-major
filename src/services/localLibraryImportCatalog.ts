import type { LocalSong } from '../types';

// src/services/localLibraryImportCatalog.ts
// The local library is gone. Imports no longer create assignments.

export const assignImportedSongs = async (
    _songs: LocalSong[],
    _options: { preserveNonImportAssignments?: boolean } = {},
): Promise<void> => {};

export const ensureLocalLibraryInitialized = async (): Promise<void> => {};
