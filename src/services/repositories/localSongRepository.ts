import type { LocalSong } from '../../types';

// src/services/repositories/localSongRepository.ts
// The local library is gone. Song rows are no longer read or written.

export const sanitizeLocalSongForStorage = (song: LocalSong): LocalSong => song;

export const putLocalSong = async (_song: LocalSong): Promise<void> => {};

export const putLocalSongs = async (_songs: LocalSong[]): Promise<void> => {};

export const readLocalSongs = async (): Promise<LocalSong[]> => [];

export const readLocalSong = async (_id: string): Promise<LocalSong | undefined> => undefined;

export const removeLocalSong = async (_id: string): Promise<void> => {};

export const removeLocalSongs = async (_ids: string[]): Promise<void> => {};
