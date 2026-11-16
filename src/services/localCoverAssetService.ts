import type { LocalSong } from '../types';

// src/services/localCoverAssetService.ts
// The local library is gone. Cover blobs are no longer stored.

export interface PreparedLocalCoverBlob {
    assetId?: string;
    blob: Blob;
}

export const resetLocalCoverAssetRuntime = (): void => {};

export const stageLocalCoverAsset = (_assetId: string | undefined, _blob: Blob | undefined): boolean => false;

export const prepareLocalCoverBlob = async (_blob: Blob): Promise<PreparedLocalCoverBlob | null> => null;

export const prepareLocalSongsCoverAssets = async (songs: LocalSong[]): Promise<LocalSong[]> => songs;

export const deleteUnreferencedLocalCoverAssets = async (_assetIds: Iterable<string>): Promise<void> => {};

export const migrateLegacyLocalCoverAssetsInBackground = (): Promise<void> => Promise.resolve();

export const cancelLocalCoverAssetMigration = async (): Promise<void> => {};
