import { describe, expect, it } from 'vitest';
import { parseDeploymentLock } from '../../../src/services/onlineMusic/deploymentLock';
import { isEmbyMusicLibrary } from '../../../src/services/onlineMusic/emby/embyApi';
import { textSubtitleTarget } from '../../../src/services/onlineMusic/emby/embyLyrics';

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
