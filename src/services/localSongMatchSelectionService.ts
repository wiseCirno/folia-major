import type { AmllDbPlatform, LyricData, LyricProviderSource } from '../types';
import type { LocalLibraryAssignmentOrigin } from '../types/localLibrary';
import type { OnlineMetadataCandidate } from './onlineMetadataSearchService';

// src/services/localSongMatchSelectionService.ts
// The local library is gone. Match selections are no longer stored.

export type LocalSongMetadataSelection = 'online' | 'imported' | 'keep';
export type LocalSongCoverSelection = 'online' | 'embedded' | 'keep';
export type LocalSongLyricsSelection = 'online' | 'local' | 'embedded' | 'automatic' | 'keep';

export interface LocalSongOnlineLyricsSelection {
    lyrics: LyricData;
    songId: number | string;
    source: LyricProviderSource;
    providerPlatform?: AmllDbPlatform;
    isPureMusic: boolean;
}

export interface ApplyLocalSongMatchSelectionInput {
    songId: string;
    candidate?: OnlineMetadataCandidate;
    metadata: LocalSongMetadataSelection;
    cover: LocalSongCoverSelection;
    lyrics: LocalSongLyricsSelection;
    onlineLyrics?: LocalSongOnlineLyricsSelection;
    setNoAutoMatch?: boolean;
    setPureMusicMark?: boolean;
    lyricsFailed?: boolean;
    matchMode?: 'automatic' | 'manual';
    protectOrigins?: LocalLibraryAssignmentOrigin[];
}

export interface ApplyLocalSongMatchSelectionResult {
    coverAttempted: boolean;
    coverCached: boolean;
    lyricsApplied: boolean;
    partialLyricsFailure: boolean;
}

const emptyResult = (): ApplyLocalSongMatchSelectionResult => ({
    coverAttempted: false,
    coverCached: false,
    lyricsApplied: false,
    partialLyricsFailure: false,
});

export const resolveLyricMatchMetadataSelection = (
    _source: LyricProviderSource,
    candidate: OnlineMetadataCandidate,
    _toggles: { useOnlineMetadata: boolean; useOnlineCover: boolean },
): Pick<ApplyLocalSongMatchSelectionInput, 'candidate' | 'metadata' | 'cover'> => ({
    candidate,
    metadata: 'keep',
    cover: 'keep',
});

export const applyLocalSongMatchSelection = async (
    _input: ApplyLocalSongMatchSelectionInput,
): Promise<ApplyLocalSongMatchSelectionResult> => emptyResult();

export const setLocalSongPureMusicMark = async (_songId: string, _marked: boolean): Promise<void> => {};
