import type { LocalSong, LyricData } from '../types';

// src/services/localMusicService.ts
// The local library is gone. These exports stay so existing callers compile.

export function extractMetadataFromFilename(_fileName: string): { title?: string; artist?: string } {
    return {};
}

export async function importFolder(_expectedRootName?: string): Promise<LocalSong[]> {
    return [];
}

export async function importDirectoryHandle(_dirHandle: FileSystemDirectoryHandle): Promise<LocalSong[]> {
    return [];
}

export async function matchLyrics(_song: LocalSong): Promise<LyricData | null> {
    return null;
}

export async function deleteLocalSong(_id: string): Promise<void> {}

export async function getAudioFromLocalSong(_song: LocalSong): Promise<string | null> {
    return null;
}

export async function getFileFromLocalSong(_song: LocalSong): Promise<File | null> {
    return null;
}

export async function getLocalSongArrayBuffer(_song: LocalSong): Promise<ArrayBuffer | null> {
    return null;
}

export async function ensureLocalSongCoverAsset(song: LocalSong): Promise<LocalSong> {
    return song;
}

export async function getAudioFromFile(_file: File): Promise<string> {
    return '';
}

export async function deleteSongsByIds(_songIds: string[]): Promise<void> {}

export function removeImportedRoot(_rootFolderName: string): Promise<void> {
    return Promise.resolve();
}

export async function resyncFolder(_folderName: string): Promise<LocalSong[] | null> {
    return null;
}

export async function resyncAllFolders(): Promise<LocalSong[] | null> {
    return null;
}

export async function clearFolderIgnore(_folderName: string): Promise<void> {}

export function deleteFolderSongs(_folderName: string): Promise<void> {
    return Promise.resolve();
}
