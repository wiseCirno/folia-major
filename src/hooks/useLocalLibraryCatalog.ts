import { useCallback, useMemo } from 'react';
import type { LocalLibraryAssignment, LocalLibraryEntity } from '../types/localLibrary';

// src/hooks/useLocalLibraryCatalog.ts
// The local library is gone. Callers still receive an empty, ready catalog.

export interface LocalLibraryCatalogSnapshot {
  entities: LocalLibraryEntity[];
  assignments: LocalLibraryAssignment[];
  ready: boolean;
  /** The catalog could not be read, and there is none from before: `ready` does not come by waiting. */
  failed: boolean;
  reload: () => Promise<void>;
}

export const useLocalLibraryCatalog = (_refreshKey: unknown): LocalLibraryCatalogSnapshot => {
  const reload = useCallback(async () => {}, []);
  return useMemo(() => ({
    entities: [],
    assignments: [],
    ready: true,
    failed: false,
    reload,
  }), [reload]);
};
