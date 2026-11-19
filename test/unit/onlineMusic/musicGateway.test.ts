import { createServer, type RequestListener } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import music from '../../../api-ts/music';

async function serve(listener: RequestListener) {
    const server = createServer(listener);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('TCP address missing');
    return { url: `http://127.0.0.1:${address.port}`, close: () => server.close() };
}

const cleanups: (() => void)[] = [];
afterEach(() => {
    cleanups.splice(0).forEach(close => close());
    vi.unstubAllEnvs();
});

async function setup(platform: string, upstream: RequestListener) {
    const origin = await serve(upstream);
    const gateway = await serve((req, res) => { void music(req, res); });
    cleanups.push(origin.close, gateway.close);
    vi.stubEnv('FOLIA_ONLINE_PLATFORM', platform);
    vi.stubEnv('FOLIA_ONLINE_SERVER_URL', `${origin.url}/base`);
    vi.stubEnv('FOLIA_ONLINE_API_KEY', '');
    vi.stubEnv('FOLIA_ONLINE_EMBY_USER_ID', '');
    vi.stubEnv('FOLIA_ONLINE_USERNAME', 'test-account');
    vi.stubEnv('FOLIA_ONLINE_PASSWORD', 'test-password');
    return (path: string, init?: RequestInit) => fetch(`${gateway.url}/api/music?${new URLSearchParams({ provider: platform, path })}`, init);
}

const json = (body: object) => JSON.stringify(body);

describe('same-origin music gateway', () => {
    it('signs in to Emby server-side, projects metadata and forwards an audio range', async () => {
        const calls: { url: string; token: string | undefined; range: string | undefined }[] = [];
        const request = await setup('emby', (req, res) => {
            const url = req.url ?? '';
            const token = req.headers['x-emby-token']?.toString();
            calls.push({ url, token, range: req.headers.range });
            if (url === '/base/Users/AuthenticateByName') {
                res.end(json({ AccessToken: 'private-token', User: { Id: 'real-id', Name: 'real-user' } }));
            } else if (url.startsWith('/base/Users/real-id/Items?')) {
                const params = new URL(url, 'http://fixture.invalid').searchParams;
                if (params.get('ParentId') === 'music' && params.get('IncludeItemTypes') === 'Audio'
                    && params.get('SortBy') === 'DateCreated' && params.get('SortOrder') === 'Descending') {
                    res.end(json({ Items: [{ Id: 'song', Type: 'Audio', Name: 'Latest' }] }));
                } else res.writeHead(400).end();
            } else if (url.startsWith('/base/Users/real-id/Views')) {
                res.end(json({ Items: [{ Id: 'music', Name: 'Music', CollectionType: 'music', Path: '/private', AccessToken: 'private-token' }, { Id: 'video', CollectionType: 'movies' }] }));
            } else if (url === '/base/Users/real-id/Items/song') {
                res.end(json({ Type: 'Audio', Id: 'song' }));
            } else if (url.startsWith('/base/Audio/song/stream')) {
                res.writeHead(206, { 'Content-Type': 'audio/mpeg', 'Content-Range': 'bytes 1-2/4', 'Accept-Ranges': 'bytes' });
                res.end('bc');
            } else res.writeHead(404).end();
        });
        expect(await (await request('/Users')).json()).toEqual([{ Id: 'deployment', Name: 'Emby' }]);
        expect(await (await request('/Users/deployment/Views?api_key=client')).json()).toEqual({ Items: [{ Id: 'music', Name: 'Music', CollectionType: 'music' }] });
        const audio = await request('/Audio/song/stream', { headers: { Range: 'bytes=1-2', Authorization: 'client' } });
        expect(audio.status).toBe(206);
        expect(audio.headers.get('cache-control')).toBe('private, no-store');
        expect(audio.headers.get('content-range')).toBe('bytes 1-2/4');
        expect(await audio.text()).toBe('bc');
        expect(calls.at(-1)).toEqual({ url: '/base/Audio/song/stream?static=true', token: 'private-token', range: 'bytes=1-2' });
        expect(calls.filter(call => call.url.endsWith('/AuthenticateByName'))).toHaveLength(1);
        const latest = await (await request('/Users/deployment/Items?IncludeItemTypes=Audio&ParentId=music&Recursive=true&Limit=12&SortBy=DateCreated&SortOrder=Descending')).json();
        expect(latest).toMatchObject({ Items: [{ Id: 'song', Type: 'Audio' }] });
        expect((await request('/Users/deployment/FavoriteItems/song', { method: 'POST' })).status).toBe(405);
        expect((await request('/Users/other/Items')).status).toBe(404);
    });

    it('serves Emby covers and LRC using an API key without returning it', async () => {
        const tokens: (string | string[] | undefined)[] = [];
        const request = await setup('emby', (req, res) => {
            tokens.push(req.headers['x-emby-token']);
            const url = req.url ?? '';
            if (url.startsWith('/base/Users/music-user/Items/song')) {
                res.end(json({ Type: 'Audio', Id: 'song', MediaSources: [{ Id: 'source', Path: '/private/song', MediaStreams: [{ Index: 1, Type: 'Subtitle', IsTextSubtitleStream: true }] }] }));
            } else if (url.startsWith('/base/Items/song/Images/Primary')) {
                res.writeHead(200, { 'Content-Type': 'image/png' }).end('image');
            } else if (url.startsWith('/base/Videos/song/source/Subtitles/1/Stream.lrc')) {
                res.writeHead(200, { 'Content-Type': 'application/octet-stream' }).end('[00:00.00]Test');
            } else res.writeHead(404).end();
        });
        vi.stubEnv('FOLIA_ONLINE_API_KEY', 'server-key');
        vi.stubEnv('FOLIA_ONLINE_EMBY_USER_ID', 'music-user');
        const details = await (await request('/Users/deployment/Items/song?Fields=MediaSources')).text();
        expect(details).toContain('"IsTextSubtitleStream":true');
        expect(details).not.toContain('/private/');
        const cover = await request('/Items/song/Images/Primary?tag=v1');
        expect(cover.headers.get('content-type')).toBe('image/png');
        expect(cover.headers.get('cache-control')).toBe('private, max-age=3600');
        expect(await cover.text()).toBe('image');
        const unversionedCover = await request('/Items/song/Images/Primary');
        expect(unversionedCover.headers.get('cache-control')).toBe('private, max-age=300');
        await unversionedCover.text();
        const lyric = await request('/Videos/song/source/Subtitles/1/Stream.lrc');
        expect(lyric.headers.get('content-type')).toBe('text/plain; charset=utf-8');
        expect(await lyric.text()).toBe('[00:00.00]Test');
        expect(tokens).toHaveLength(8);
        expect(new Set(tokens)).toEqual(new Set(['server-key']));
    });

    it('uses server-owned Subsonic auth, rejects redirects and strips upstream paths', async () => {
        const calls: URL[] = [];
        const request = await setup('navidrome', (req, res) => {
            const url = new URL(req.url ?? '/', 'http://test.invalid');
            calls.push(url);
            if (url.pathname.endsWith('/stream')) res.writeHead(302, { Location: '/private-target' }).end();
            else res.end(json({ 'subsonic-response': { status: 'ok', song: { id: 'song', title: 'Test', path: '/private/song', artistImageUrl: 'https://origin.invalid/private' } } }));
        });
        const response = await request('/rest/getSong?id=song&u=client&t=client');
        expect(await response.json()).toEqual({ 'subsonic-response': { status: 'ok', song: { id: 'song', title: 'Test' } } });
        expect(calls[0].searchParams.get('u')).toBe('test-account');
        expect(calls[0].searchParams.get('t')).toMatch(/^[0-9a-f]{32}$/);
        expect((await request('/rest/star?id=song')).status).toBe(404);
        const redirect = await request('/rest/stream?id=song');
        expect(redirect.status).toBe(502);
        expect(redirect.headers.has('location')).toBe(false);
        expect(calls).toHaveLength(2);
    });
});
