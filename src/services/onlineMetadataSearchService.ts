import type { LocalSong, LyricProviderSource, SongResult } from '../types';
import type { LocalSongMetadataSource } from '../types/localLibrary';
import { getProviderSongMetadata } from './onlineMusic/songMetadata';
import { calculateMatchScoreDetails } from '../utils/lyrics/matchScore';
import { buildLyricSearchQuery } from '../utils/lyrics/searchQuery';
import {
    getMatchResultAlbumId,
    getMatchResultAlbumName,
    getMatchResultArtistEntities,
} from '../utils/lyrics/matchResult';

// src/services/onlineMetadataSearchService.ts
// Searches song metadata without invoking any lyric provider or lyric download path.

export type OnlineMetadataSource = LocalSongMetadataSource;

export interface OnlineMetadataSearchTarget {
    title: string;
    artist: string;
    album?: string;
    durationMs: number;
}

export interface OnlineMetadataCandidate {
    source: OnlineMetadataSource;
    songId: number | string;
    title: string;
    artists: Array<{ id?: number | string; name: string }>;
    album?: { id?: number | string; name: string };
    coverUrl?: string;
    durationMs: number;
    score: number;
    titleMatched: boolean;
    durationMatched: boolean | null;
    raw: SongResult;
}

const stripAudioExtension = (fileName: string) => fileName.replace(/\.(mp3|flac|m4a|wav|ogg|opus|aac)$/i, '');

export const buildLocalSongMetadataSearchTarget = (song: LocalSong): OnlineMetadataSearchTarget => ({
    title: song.title || stripAudioExtension(song.fileName),
    artist: song.titleOrigin === 'import'
        ? song.importedMetadata.artistNames.join(', ')
        : song.onlineMetadata?.artists.map(artist => artist.name).join(', ') || song.importedMetadata.artistNames.join(', '),
    album: song.titleOrigin === 'import'
        ? song.importedMetadata.albumName || ''
        : song.onlineMetadata?.album?.name || song.importedMetadata.albumName || '',
    durationMs: song.duration || 0,
});

export const buildLocalSongMetadataSearchQuery = (song: LocalSong): string => {
    const target = buildLocalSongMetadataSearchTarget(song);
    return buildLyricSearchQuery(target.title, target.artist, target.album);
};

export const normalizeOnlineMetadataCandidate = (
    source: OnlineMetadataSource,
    result: SongResult,
    target: OnlineMetadataSearchTarget,
): OnlineMetadataCandidate => {
    const details = calculateMatchScoreDetails(target, result);
    const albumName = getMatchResultAlbumName(result).trim();
    const albumId = getMatchResultAlbumId(result);
    return {
        source,
        songId: source === 'qq' && result.qqMid
            ? result.qqMid
            : source === 'kugou' && result.kgHash
                ? result.kgHash
                : result.id,
        title: result.name || '',
        artists: getMatchResultArtistEntities(result),
        album: albumName ? { id: albumId, name: albumName } : undefined,
        coverUrl: getProviderSongMetadata(result).coverUrl?.replace('http:', 'https:') || undefined,
        durationMs: getProviderSongMetadata(result).durationMs,
        score: details.score,
        titleMatched: details.titleMatched,
        durationMatched: details.durationMatched,
        raw: result,
    };
};

export const normalizeLyricMatchMetadataCandidate = (
    lyricSource: LyricProviderSource,
    result: SongResult,
    target: OnlineMetadataSearchTarget,
): OnlineMetadataCandidate => {
    const source: OnlineMetadataSource = lyricSource === 'amll'
        ? result.amllDbPlatform === 'qq' ? 'qq' : 'netease'
        : lyricSource;
    return normalizeOnlineMetadataCandidate(source, result, target);
};

const throwIfAborted = (signal?: AbortSignal) => {
    if (!signal?.aborted) return;
    const error = new Error('Metadata matching was cancelled');
    error.name = 'AbortError';
    throw error;
};

export async function searchOnlineMetadata(
    source: OnlineMetadataSource,
    query: string,
    target: OnlineMetadataSearchTarget,
    options: { limit?: number; signal?: AbortSignal } = {},
): Promise<OnlineMetadataCandidate[]> {
    const safeQuery = query.trim();
    if (!safeQuery) return [];
    throwIfAborted(options.signal);
    // Those platforms are no longer registered. Older records still name them; a new search does not.
    void source;
    void target;
    return [];
}

// Preserves the established NetEase-to-QQ fallback and appends KuGou as the final provider-backed source.
export async function findAutomaticOnlineMetadataCandidate(
    song: LocalSong,
    signal?: AbortSignal,
): Promise<OnlineMetadataCandidate | null> {
    void song;
    void signal;
    return null;
}
