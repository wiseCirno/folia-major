import Dexie, { type Table } from 'dexie';
import type { LocalSong } from '../types';
import type { LocalLibraryAssignment, LocalLibraryEntity } from '../types/localLibrary';
import type { LocalCoverAsset } from '../types/localCover';

// src/services/appDatabase.ts
// Owns the typed Dexie schema. Local-library tables stay until the services that read them are removed.

export const APP_DATABASE_NAME = 'KineticPlayerDB';
export const APP_DATABASE_VERSION_CHANGE_EVENT = 'folia-database-version-change';
export const LOCAL_LIBRARY_BOOTSTRAP_MARKER_KEY = 'local_library_entities_bootstrap_v1';
export const LOCAL_LIBRARY_ARTIST_SPLIT_MARKER_KEY = 'local_library_artist_delimiter_split_v1';

export interface StoredCacheEntry<T = unknown> {
  key: string;
  data: T;
  timestamp: number;
}

export interface ThemeRegistryRecord {
  fingerprint: string;
  [key: string]: unknown;
}

export class AppDatabase extends Dexie {
  session!: Table<unknown, string>;
  api_cache!: Table<StoredCacheEntry, string>;
  user_cache!: Table<StoredCacheEntry, string>;
  media_cache!: Table<StoredCacheEntry, string>;
  metadata_cache!: Table<StoredCacheEntry, string>;
  local_music!: Table<LocalSong, string>;
  theme_registry!: Table<ThemeRegistryRecord, string>;
  local_library_entities!: Table<LocalLibraryEntity, string>;
  local_library_assignments!: Table<LocalLibraryAssignment, string>;
  local_cover_assets!: Table<LocalCoverAsset, string>;

  constructor(name = APP_DATABASE_NAME) {
    super(name);

    this.version(0.6).stores({
      session: '',
      api_cache: 'key',
      user_cache: 'key',
      media_cache: 'key',
      metadata_cache: 'key',
      local_music: 'id',
      theme_registry: 'fingerprint',
    });

    this.version(0.7).stores({
      session: '',
      api_cache: 'key',
      user_cache: 'key',
      media_cache: 'key',
      metadata_cache: 'key',
      local_music: 'id',
      theme_registry: 'fingerprint',
      local_library_entities: 'id, kind, *normalizedAliases, mergedInto, needsReview, createdAt',
      local_library_assignments: 'songId, *artistEntityIds, albumEntityId, artistOrigin, albumOrigin',
    });

    this.version(0.8).stores({
      session: '',
      api_cache: 'key',
      user_cache: 'key',
      media_cache: 'key',
      metadata_cache: 'key',
      local_music: 'id',
      theme_registry: 'fingerprint',
      local_library_entities: 'id, kind, *normalizedAliases, mergedInto, needsReview, createdAt',
      local_library_assignments: 'songId, *artistEntityIds, albumEntityId, artistOrigin, albumOrigin',
    });

    this.version(0.9).stores({
      session: '',
      api_cache: 'key',
      user_cache: 'key',
      media_cache: 'key',
      metadata_cache: 'key',
      local_music: 'id, localCoverAssetId',
      theme_registry: 'fingerprint',
      local_library_entities: 'id, kind, *normalizedAliases, mergedInto, needsReview, createdAt',
      local_library_assignments: 'songId, *artistEntityIds, albumEntityId, artistOrigin, albumOrigin',
      local_cover_assets: 'id',
    });

    // albumContextKey: the import-time folder + album key, so assigning an imported batch finds same-folder
    // albums by index instead of reading every song. Existing records get it once here; writes keep it current.
    this.version(1).stores({
      session: '',
      api_cache: 'key',
      user_cache: 'key',
      media_cache: 'key',
      metadata_cache: 'key',
      local_music: 'id, localCoverAssetId, albumContextKey',
      theme_registry: 'fingerprint',
      local_library_entities: 'id, kind, *normalizedAliases, mergedInto, needsReview, createdAt',
      local_library_assignments: 'songId, *artistEntityIds, albumEntityId, artistOrigin, albumOrigin',
      local_cover_assets: 'id',
    });

    this.on('versionchange', event => {
      this.close();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(APP_DATABASE_VERSION_CHANGE_EVENT, {
          detail: { oldVersion: event.oldVersion, newVersion: event.newVersion },
        }));
        window.setTimeout(() => window.location.reload(), 0);
      }
    });
  }
}

export const appDatabase = new AppDatabase();
