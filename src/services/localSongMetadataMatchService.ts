import type { LocalSong } from '../types';
import type { LocalLibraryAssignmentOrigin } from '../types/localLibrary';
import type { OnlineMetadataCandidate } from './onlineMetadataSearchService';

// src/services/localSongMetadataMatchService.ts
// The local library is gone. Online metadata is no longer written onto local songs.

export type LocalSongMetadataMatchStatus = 'matched' | 'matched-cover-failed' | 'no-match' | 'skipped' | 'failed';

export interface LocalSongMetadataMatchUpdate {
    songId: string;
    status: LocalSongMetadataMatchStatus;
    candidate?: OnlineMetadataCandidate;
    error?: unknown;
}

export interface BatchLocalSongMetadataMatchResult {
    updates: LocalSongMetadataMatchUpdate[];
    cancelled: boolean;
}

export interface ApplyOnlineMetadataCandidateOptions {
    mode: 'automatic' | 'manual';
    protectOrigins?: LocalLibraryAssignmentOrigin[];
    useOnlineMetadata?: boolean;
    useOnlineCover?: boolean;
}

export const applyOnlineMetadataCandidate = async (
    _song: LocalSong,
    _candidate: OnlineMetadataCandidate,
    _options: ApplyOnlineMetadataCandidateOptions,
): Promise<{ song?: LocalSong; coverAttempted: boolean; coverCached: boolean }> => ({
    coverAttempted: false,
    coverCached: false,
});

export const useImportedSnapshotForLocalSong = async (_songId: string): Promise<void> => {};

export async function batchAutoMatchLocalSongMetadata(
    _songs: LocalSong[],
    _options: {
        signal?: AbortSignal;
        onUpdate?: (update: LocalSongMetadataMatchUpdate) => void;
        concurrency?: number;
    } = {},
): Promise<BatchLocalSongMetadataMatchResult> {
    return { updates: [], cancelled: false };
}
