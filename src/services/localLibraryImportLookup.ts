import type { LocalSong } from '../types';
import { buildLocalLibraryIndex } from '../utils/localLibraryIndex';
import type { ImportAssignmentLookup } from '../utils/localLibraryImportAssignment';

// src/services/localLibraryImportLookup.ts
// The local library is gone. Import lookup no longer reads IndexedDB.

export const prefetchImportAssignmentLookup = async (
    _songs: LocalSong[],
    _preserveNonImportAssignments: boolean,
): Promise<ImportAssignmentLookup> => ({
    index: buildLocalLibraryIndex([]),
    currentAssignments: new Map(),
    contextAlbumIds: new Map(),
    artistAliasEntityIds: new Map(),
    albumIdsByArtistEntity: new Map(),
    albumMembers: new Map(),
});
