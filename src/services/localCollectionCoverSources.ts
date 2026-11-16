// src/services/localCollectionCoverSources.ts
// The local library is gone. Folder posters and embedded covers are no longer read.

export const LOCAL_COLLECTION_COVER_MAX_EDGE = 1024;

export const prepareLocalCollectionCoverImage = async (source: Blob): Promise<Blob> => source;

export type LocalFolderPosterLookup =
    | { status: 'found'; file: File }
    | { status: 'missing' }
    | { status: 'no-access' }
    | { status: 'unavailable' };

export const findLocalFolderPoster = async (
    _folderPath: string,
    _options: { requestAccess?: boolean } = {},
): Promise<LocalFolderPosterLookup> => ({ status: 'unavailable' });

export const loadLocalSongCoverBlob = async (_candidates: readonly string[], _songId: string): Promise<Blob> => new Blob();
