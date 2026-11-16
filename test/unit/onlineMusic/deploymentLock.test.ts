import { describe, expect, it } from 'vitest';
import { parseDeploymentLock } from '@/services/onlineMusic/deploymentLock.ts';
import { isEmbyMusicLibrary } from '@/services/onlineMusic/emby/embyApi.ts';
import { textSubtitleTarget } from '@/services/onlineMusic/emby/embyLyrics.ts';

describe('parseDeploymentLock', () => {
    it('requires a platform, an http server, and either an API key or a username and password', () => {
        expect(parseDeploymentLock({})).toBeNull();
        expect(parseDeploymentLock({
            VITE_FOLIA_ONLINE_PLATFORM: 'EMBY',
            VITE_FOLIA_ONLINE_SERVER_URL: 'https://emby.example.com/',
            VITE_FOLIA_ONLINE_API_KEY: 'key',
            VITE_FOLIA_ONLINE_USERNAME: 'ada',
        })).toEqual({
            platformId: 'emby',
            serverUrl: 'https://emby.example.com',
            apiKey: 'key',
            username: 'ada',
            password: '',
        });
        expect(parseDeploymentLock({
            VITE_FOLIA_ONLINE_PLATFORM: 'emby',
            VITE_FOLIA_ONLINE_SERVER_URL: 'emby.example.com',
            VITE_FOLIA_ONLINE_API_KEY: 'key',
        })).toBeNull();
        expect(parseDeploymentLock({
            VITE_FOLIA_ONLINE_PLATFORM: 'navidrome',
            VITE_FOLIA_ONLINE_SERVER_URL: 'https://music.example.com',
            VITE_FOLIA_ONLINE_USERNAME: 'ada',
            VITE_FOLIA_ONLINE_PASSWORD: 'secret',
        })).toMatchObject({ platformId: 'navidrome', username: 'ada', password: 'secret', apiKey: '' });
        expect(parseDeploymentLock({
            FOLIA_ONLINE_PLATFORM: 'emby',
            FOLIA_ONLINE_SERVER_URL: 'https://emby.example.com',
            FOLIA_ONLINE_API_KEY: 'key',
        })).toMatchObject({ platformId: 'emby', serverUrl: 'https://emby.example.com', apiKey: 'key' });
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
