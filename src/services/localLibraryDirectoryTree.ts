import type { LocalLibrarySnapshot, LocalSong } from '../types';
import type { LibraryDirectoryNode } from '../library/core/directory/directory.contract';

// src/services/localLibraryDirectoryTree.ts
// The local library is gone. Folder trees stay empty.

export const buildLocalLibraryDirectoryTrees = (
    _snapshots: LocalLibrarySnapshot[],
    _songs: LocalSong[],
): LibraryDirectoryNode[] => [];

export const loadLocalLibraryDirectoryTrees = async (_songs?: LocalSong[]): Promise<LibraryDirectoryNode[]> => [];
