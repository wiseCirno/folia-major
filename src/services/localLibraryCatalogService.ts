import type { LocalSong } from '../types';
import type { LocalLibraryAssignmentOrigin, LocalSongMetadataSource } from '../types/localLibrary';
export {
    mergeEntities,
    moveEntityMembersToExistingEntity,
    setEntityDisplayName,
    splitArtistEntityToTargets,
    splitEntity,
} from './localLibraryEntityMutations';

// src/services/localLibraryCatalogService.ts
// The local library is gone. Metadata writes are no longer stored.

export interface MatchedLocalMetadata {
    source?: LocalSongMetadataSource;
    title?: string;
    artists?: Array<{ id?: number | string; name: string }>;
    album?: { id?: number | string; name: string };
    songId?: number | string;
    coverUrl?: string;
}

export const applyMatchedMetadata = async (
    _songId: string,
    _metadata: MatchedLocalMetadata,
    _options: {
        lyricsOnly?: boolean;
        songPatch?: Partial<LocalSong>;
        protectOrigins?: LocalLibraryAssignmentOrigin[];
        assignmentOrigin?: Extract<LocalLibraryAssignmentOrigin, 'auto-match' | 'manual-match'>;
        skipIfMarkedPureMusic?: boolean;
    } = {},
): Promise<LocalSong | undefined> => undefined;

export const applyManualMetadata = async (
    _songId: string,
    _artistNames: string[],
    _albumName?: string,
): Promise<LocalSong | undefined> => undefined;

export const restoreImportedMetadata = async (
    _songId: string,
    _songPatch: Partial<LocalSong> = {},
): Promise<LocalSong | undefined> => undefined;

export const deleteSongAssignment = async (_songId: string): Promise<void> => {};

export const deleteSongAssignments = async (_songIds: string[]): Promise<void> => {};
