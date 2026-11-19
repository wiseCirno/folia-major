import { describe, expect, it } from 'vitest';
import { deploymentMusicUrl, readDeploymentLock } from '@/services/onlineMusic/deploymentLock.ts';
import { readMusicConfig } from '../../../api-ts/music';
import { isEmbyMusicLibrary } from '@/services/onlineMusic/emby/embyApi.ts';
import { textSubtitleTarget } from '@/services/onlineMusic/emby/embyLyrics.ts';

describe('deployment lock', () => {
    it('keeps configuration on the server and produces relative URLs', () => {
        expect(readDeploymentLock()).toBeNull();
        expect(deploymentMusicUrl('emby', '/Users')).toBe('/api/music?provider=emby&path=%2FUsers');
        expect(readMusicConfig({ VITE_FOLIA_ONLINE_PLATFORM: 'emby' })).toBeNull();
        expect(readMusicConfig({
            FOLIA_ONLINE_PLATFORM: 'EMBY',
            FOLIA_ONLINE_SERVER_URL: 'https://emby.example.com/base/',
            FOLIA_ONLINE_API_KEY: 'test-key',
        })).toMatchObject({ platform: 'emby', origin: 'https://emby.example.com/base', key: 'test-key' });
    });
});

describe('isEmbyMusicLibrary', () => {
    it('keeps music libraries and leaves movies and shows out', () => {
        expect(isEmbyMusicLibrary({ CollectionType: 'music' })).toBe(true);
        expect(isEmbyMusicLibrary({ CollectionType: 'Music' })).toBe(true);
        expect(isEmbyMusicLibrary({ CollectionType: 'movies' })).toBe(false);
        expect(isEmbyMusicLibrary({ CollectionType: 'tvshows' })).toBe(false);
    });
});

describe('textSubtitleTarget', () => {
    it('uses the first text subtitle stream and ignores other streams', () => {
        expect(textSubtitleTarget([{
            Id: 'source',
            MediaStreams: [
                { Index: 0, Type: 'Audio' },
                { Index: 1, Type: 'Subtitle', IsTextSubtitleStream: false },
                { Index: 2, Type: 'Subtitle', IsTextSubtitleStream: true },
            ],
        }])).toEqual({ mediaSourceId: 'source', index: 2 });
        expect(textSubtitleTarget([{ Id: 'source', MediaStreams: [] }])).toBeNull();
    });
});
