import type { LocalPlaylist, LocalSong } from '../types';

// src/services/localPlaylistService.ts
// The local library is gone. Playlist writes are no longer stored.

const emptyPlaylist = (name = ''): LocalPlaylist => ({
    id: 'local-playlist-removed',
    name,
    songIds: [],
    createdAt: 0,
    updatedAt: 0,
});

export const buildCanonicalLocalSongIdIndex = (_songs: LocalSong[]): Map<string, string> => new Map();

export const resolveCanonicalLocalSongId = (songId: string, _songs: LocalSong[]): string => songId;

export const getLocalPlaylists = async (): Promise<LocalPlaylist[]> => [];

export const saveLocalPlaylists = async (playlists: LocalPlaylist[]): Promise<LocalPlaylist[]> => playlists;

export const createLocalPlaylist = async (name: string, songs: LocalSong[] = []): Promise<LocalPlaylist> => ({
    ...emptyPlaylist(name),
    songIds: songs.map(song => song.id),
});

export const updateLocalPlaylist = async (
    _playlistId: string,
    _updater: (playlist: LocalPlaylist) => LocalPlaylist,
): Promise<LocalPlaylist | null> => null;

export const deleteLocalPlaylist = async (_playlistId: string): Promise<void> => {};

export const canDeleteLocalPlaylist = (playlist: LocalPlaylist | null | undefined): boolean => Boolean(playlist && !playlist.isFavorite);

export const addSongsToLocalPlaylist = async (_playlistId: string, _songs: LocalSong[]): Promise<LocalPlaylist | null> => null;

export const removeSongsFromLocalPlaylist = async (_playlistId: string, _songIds: string[]): Promise<LocalPlaylist | null> => null;

export const reorderLocalPlaylistSongs = async (_playlistId: string, _songIds: string[]): Promise<LocalPlaylist | null> => null;

export const getFavoriteLocalPlaylist = async (): Promise<LocalPlaylist> => ({
    ...emptyPlaylist('Favorites'),
    isFavorite: true,
});

export const setLocalSongFavorite = async (_song: LocalSong, _shouldFavorite: boolean): Promise<LocalPlaylist | null> => null;
