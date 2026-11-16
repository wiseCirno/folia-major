import { describe, expect, it } from 'vitest';
import { parseDeploymentLock } from '../../../src/services/onlineMusic/deploymentLock';
import { textSubtitleTarget } from '../../../src/services/onlineMusic/emby/embyLyrics';

describe('parseDeploymentLock', () => {
    it('requires a platform, an http server, and an API key', () => {
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
