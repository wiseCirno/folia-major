import type { LocalSong } from '../types';
import type { LocalLibraryAssignment, LocalLibraryEntity } from '../types/localLibrary';

// src/services/localLibraryV8Migration.ts
// Older local-library rows are no longer migrated. The tables stay only so existing databases still open.

type LegacyLocalSong = LocalSong & Record<string, unknown>;

export const migrateLegacyLocalSongRecords = (
    _records: LegacyLocalSong[],
    _now = Date.now(),
): { songs: LocalSong[]; entities: LocalLibraryEntity[]; assignments: LocalLibraryAssignment[] } => ({
    songs: [],
    entities: [],
    assignments: [],
});
