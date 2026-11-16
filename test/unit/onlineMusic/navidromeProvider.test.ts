import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearNavidromeConfig, getNavidromeConfig, saveNavidromeConfig } from '@/services/navidromeService';
import { navidromeProvider, normalizeNavidromeSong } from '@/services/onlineMusic/navidrome/navidromeProvider';
import { OnlineProviderError } from '@/types/onlineMusic';
import { getPlaybackSongKey } from '@/utils/appPlaybackGuards';
import type { SongResult } from '@/types';

// test/unit/onlineMusic/navidromeProvider.test.ts
// Navidrome 收进 Omni 之后：旧的 kind 仍能对上同一首歌，登录失败不落凭据。

const legacySong = {
    id: -1,
    name: 'Old',
    artists: [],
    album: { id: 0, name: 'Album' },
    durationMs: 1000,
    sourceRef: { kind: 'navidrome', mediaId: 'track-1' },
} as SongResult;

const memoryStorage = () => {
    const data = new Map<string, string>();
    return {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => { data.set(key, String(value)); },
        removeItem: (key: string) => { data.delete(key); },
        clear: () => data.clear(),
    };
};

describe('navidrome omni provider', () => {
    beforeEach(() => {
        vi.stubGlobal('localStorage', memoryStorage());
    });

    afterEach(() => {
        clearNavidromeConfig();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('reads a stored navidrome song as the online provider', () => {
        expect(getPlaybackSongKey(legacySong)).toBe('online:navidrome:track-1');
    });

    it('normalizes a subsonic song onto the online identity', () => {
        saveNavidromeConfig({ serverUrl: 'https://navidrome.test', username: 'folio', passwordHash: 'secret' });
        const song = normalizeNavidromeSong({
            id: 'track-9',
            title: 'Sea',
            artist: 'Ada',
            artistId: 'artist-1',
            album: 'Bay',
            albumId: 'album-1',
            duration: 3,
            coverArt: 'cover-1',
            path: 'sea.flac',
            suffix: 'flac',
            isDir: false,
            size: 1,
            contentType: 'audio/flac',
            type: 'music',
            isVideo: false,
            created: '2020-01-01',
        });
        expect(song.sourceRef).toEqual({ kind: 'online', providerId: 'navidrome', mediaId: 'track-9' });
        expect(song.artists[0]?.catalogRef).toEqual({ providerId: 'navidrome', kind: 'artist', id: 'artist-1' });
        expect(getNavidromeConfig()?.username).toBe('folio');
    });

    it('refuses a server URL that is not http and stores nothing', async () => {
        await expect(navidromeProvider.auth?.submitLoginForm?.({
            serverUrl: 'navidrome.local',
            username: 'folio',
            password: 'secret',
        })).rejects.toMatchObject({ code: 'unavailable' });
        expect(getNavidromeConfig()).toBeNull();
        await expect(navidromeProvider.auth?.submitLoginForm?.({
            serverUrl: 'ftp://navidrome.local',
            username: 'folio',
            password: 'secret',
        })).rejects.toBeInstanceOf(OnlineProviderError);
        expect(getNavidromeConfig()).toBeNull();
    });
});
