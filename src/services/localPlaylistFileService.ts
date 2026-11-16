import type { LocalPlaylist, LocalSong } from '../types';

// src/services/localPlaylistFileService.ts
// The local library is gone. Playlist files are no longer imported or exported.

export interface ParsedM3uPlaylist {
    name?: string;
    paths: string[];
}

export interface LocalPlaylistImportResult {
    playlist: LocalPlaylist | null;
    matchedSongIds: string[];
    unmatchedPaths: string[];
    ambiguousPaths: string[];
}

export const normalizeM3uPath = (rawPath: string): string | null => {
    const trimmed = rawPath.trim();
    return trimmed ? trimmed : null;
};

export const parseM3uPlaylist = (_text: string): ParsedM3uPlaylist => ({ paths: [] });

export const matchM3uPathsToLocalSongs = (
    paths: string[],
    _localSongs: LocalSong[],
): Omit<LocalPlaylistImportResult, 'playlist'> => ({
    matchedSongIds: [],
    unmatchedPaths: paths,
    ambiguousPaths: [],
});

export const importLocalPlaylistFile = async (
    _file: File,
    _localSongs: LocalSong[],
): Promise<LocalPlaylistImportResult> => ({
    playlist: null,
    matchedSongIds: [],
    unmatchedPaths: [],
    ambiguousPaths: [],
});

export const serializeLocalPlaylistToM3u8 = (_playlist: LocalPlaylist, _localSongs: LocalSong[]): string => '';

export const downloadLocalPlaylistM3u8 = (_playlist: LocalPlaylist, _localSongs: LocalSong[]): void => {};
