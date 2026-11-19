import { createHash, randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { pipeline } from 'node:stream/promises';

// Read-only same-origin gateway for the one music provider configured on the server.
const navReads = new Set('ping getOpenSubsonicExtensions getUser getMusicFolders getLicense getAlbumList2 getAlbum getPlaylists getPlaylist getRandomSongs getStarred2 getArtists getArtist getSong getLyrics getLyricsBySongId search3 stream getCoverArt'.split(' '));
const navParams = 'id type size offset count fromYear toYear genre musicFolderId query artistCount albumCount songCount artistOffset albumOffset songOffset artist title songId format enhanced'.split(' ');
const embyParams = 'ParentId Recursive Limit StartIndex SearchTerm tag'.split(' ');
const embyFields = new Set('Items TotalRecordCount Id Name Type CollectionType ChildCount RunTimeTicks Artists Album AlbumId AlbumArtist AlbumPrimaryImageTag ImageTags Primary PrimaryImageItemId PrimaryImageTag BackdropImageTags UserData IsFavorite MediaSources MediaStreams Index IsTextSubtitleStream'.split(' '));
const navFields = new Set(('subsonic-response status version type serverVersion openSubsonic code ' +
    'openSubsonicExtensions name versions user musicFolders musicFolder license valid ' +
    'albumList2 album playlists playlist randomSongs starred2 artists index artist song lyrics lyricsList structuredLyrics searchResult3 ' +
    'id parent isDir title albumId artistId coverArt songCount albumCount duration playCount created changed starred year genre ' +
    'track size contentType suffix bitRate bitDepth samplingRate channelCount discNumber isVideo replayGain trackGain albumGain trackPeak albumPeak baseGain ' +
    'comment public entry displayArtist displayTitle lang kind line cueLine agents offset synced start end value agentId cue role byteStart byteEnd').split(' '));

type Config = { platform: 'emby' | 'navidrome'; origin: string; key: string; username: string; password: string; embyUserId: string };
type Route = { path: string; params: URLSearchParams; kind: 'json' | 'audio' | 'image' | 'lyrics'; item?: string; session?: boolean; views?: boolean };
const id = '[A-Za-z0-9_-]{1,128}';
const itemRoute = new RegExp(`^/Users/deployment/Items/(${id})$`);
const mediaRoute = new RegExp(`^(?:/Audio/(${id})/stream|/Items/(${id})/Images/(Primary|Backdrop)|/Videos/(${id})/${id}/Subtitles/\\d{1,5}/Stream\\.lrc)$`);

export function readMusicConfig(env: NodeJS.ProcessEnv): Config | null {
    const platform = env.FOLIA_ONLINE_PLATFORM?.trim().toLowerCase();
    if (platform !== 'emby' && platform !== 'navidrome') return null;
    const key = env.FOLIA_ONLINE_API_KEY?.trim() ?? '';
    const username = env.FOLIA_ONLINE_USERNAME?.trim() ?? '';
    const password = env.FOLIA_ONLINE_PASSWORD ?? '';
    if (!(platform === 'emby' && key) && !(username && password)) return null;
    const serverUrl = env.FOLIA_ONLINE_SERVER_URL?.trim() ?? '';
    if (!URL.canParse(serverUrl)) return null;
    const url = new URL(serverUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) return null;
    const embyUserId = env.FOLIA_ONLINE_EMBY_USER_ID?.trim() ?? '';
    if (embyUserId && !new RegExp(`^${id}$`).test(embyUserId)) return null;
    return { platform, origin: url.href.replace(/\/+$/, ''), key, username, password, embyUserId };
}

function copyParams(source: URLSearchParams, names: string[]): URLSearchParams {
    const result = new URLSearchParams();
    for (const name of names) {
        const value = source.get(name);
        if (value === null || value.length > 256) continue;
        if (/^(Limit|count|size|artistCount|albumCount|songCount)$/.test(name)) {
            if (!/^\d+$/.test(value)) continue;
            result.set(name, String(Math.min(Number(value), name === 'size' ? 1200 : 500)));
        } else {
            result.set(name, value);
        }
    }
    return result;
}

export function resolveMusicRoute(platform: Config['platform'], input: string): Route | null {
    const [path, query = ''] = input.split(/\?(.*)/s, 2);
    const supplied = new URLSearchParams(query);
    if (platform === 'navidrome') {
        const command = /^\/rest\/([A-Za-z0-9]+)$/.exec(path)?.[1];
        if (!command || !navReads.has(command)) return null;
        const params = copyParams(supplied, navParams);
        return { path, params, kind: command === 'stream' ? 'audio' : command === 'getCoverArt' ? 'image' : 'json' };
    }
    if (path === '/Users') return { path, params: new URLSearchParams(), kind: 'json', session: true };
    const params = copyParams(supplied, embyParams);
    if (path === '/Users/deployment/Views') return { path, params, kind: 'json', views: true };
    const item = itemRoute.exec(path)?.[1];
    if (item) {
        if (supplied.get('Fields') === 'MediaSources') params.set('Fields', 'MediaSources');
        return { path, params, kind: 'json', item };
    }
    if (['/Users/deployment/Items', '/Users/deployment/Items/Latest', '/Users/deployment/Suggestions'].includes(path)) {
        const types = supplied.get('IncludeItemTypes')?.split(',') ?? [];
        if (!types.length || types.some(type => type !== 'Audio' && type !== 'MusicAlbum')) return null;
        if (path === '/Users/deployment/Items' && supplied.get('SortBy') === 'DateCreated' && supplied.get('SortOrder') === 'Descending') {
            params.set('SortBy', 'DateCreated');
            params.set('SortOrder', 'Descending');
        }
        params.set('IncludeItemTypes', types.join(','));
        if (!params.has('Limit')) params.set('Limit', '100');
        params.set('Fields', 'ImageTags,PrimaryImageItemId,PrimaryImageTag,AlbumPrimaryImageTag,BackdropImageTags,UserData');
        return { path, params, kind: 'json' };
    }
    const media = mediaRoute.exec(path);
    if (!media) return null;
    if (media[1]) {
        params.set('static', 'true');
        return { path, params, kind: 'audio', item: media[1] };
    }
    if (media[2]) {
        params.set('maxWidth', '600');
        return { path, params, kind: 'image', item: media[2] };
    }
    return { path, params, kind: 'lyrics', item: media[4] };
}

type MusicJson = null | string | number | boolean | MusicJson[] | { [key: string]: MusicJson };

function project(value: unknown, fields: Set<string>): MusicJson {
    if (Array.isArray(value)) return value.map(item => project(item, fields));
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
    if (value === null || typeof value !== 'object') return null;
    return Object.fromEntries(Object.entries(value).filter(([key]) => fields.has(key))
        .map(([key, item]) => [key, project(item, fields)]));
}

const embyClient = 'MediaBrowser Client="Folia", Device="Web Gateway", DeviceId="folia-gateway", Version="1"';
type EmbyServerSession = { userId: string; token: string };
let embySession: { config: string; expires: number; result: Promise<EmbyServerSession> } | undefined;

function embyRequest(config: Config, path: string, signal: AbortSignal, token?: string, init?: RequestInit) {
    const headers = new Headers(init?.headers);
    headers.set('X-Emby-Authorization', embyClient);
    if (token) headers.set('X-Emby-Token', token);
    return fetch(`${config.origin}${path}`, { ...init, headers, signal, redirect: 'error' });
}

async function signIntoEmby(config: Config): Promise<EmbyServerSession> {
    const signal = AbortSignal.timeout(10_000);
    if (config.key) {
        if (config.embyUserId) return { token: config.key, userId: config.embyUserId };
        const response = await embyRequest(config, '/Users', signal, config.key);
        if (!response.ok) throw new Error('Emby user lookup failed');
        const users = await response.json() as { Id?: string; Policy?: { IsDisabled?: boolean } }[];
        const user = users.find(entry => entry.Id && !entry.Policy?.IsDisabled);
        if (!user?.Id || !new RegExp(`^${id}$`).test(user.Id)) throw new Error('Emby user missing');
        return { token: config.key, userId: user.Id };
    }
    const response = await embyRequest(config, '/Users/AuthenticateByName', signal, undefined, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Username: config.username, Pw: config.password }),
    });
    if (!response.ok) throw new Error('Emby authentication failed');
    const data = await response.json() as { AccessToken?: string; User?: { Id?: string } };
    if (!data.AccessToken || !data.User?.Id || !new RegExp(`^${id}$`).test(data.User.Id)) throw new Error('Emby session missing');
    return { token: data.AccessToken, userId: data.User.Id };
}

function getEmbyServerSession(config: Config): Promise<EmbyServerSession> {
    const fingerprint = createHash('sha256').update(JSON.stringify(config)).digest('hex');
    if (embySession?.config === fingerprint && embySession.expires > Date.now()) return embySession.result;
    const result = signIntoEmby(config).catch((error: unknown) => {
        if (embySession?.result === result) embySession = undefined;
        throw error;
    });
    embySession = { config: fingerprint, expires: Date.now() + 600_000, result };
    return result;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
}

async function openEmby(config: Config, route: Route, signal: AbortSignal, init: RequestInit): Promise<Response> {
    const session = await getEmbyServerSession(config);
    const userPath = `/Users/${encodeURIComponent(session.userId)}`;
    const path = route.path.replace(/^\/Users\/deployment(?=\/)/, userPath);
    if (route.session) {
        const check = await embyRequest(config, `${userPath}/Views`, signal, session.token);
        await check.body?.cancel();
        if (!check.ok) return new Response(null, { status: check.status });
        return Response.json([{ Id: 'deployment', Name: 'Emby' }]);
    }
    // Direct media lookups must not expose video or unrelated item types under the shared account.
    if (route.item) {
        const check = await embyRequest(config, `${userPath}/Items/${route.item}`, signal, session.token);
        if (!check.ok) {
            await check.body?.cancel();
            return new Response(null, { status: check.status });
        }
        const data = await check.json() as { Type?: string; CollectionType?: string };
        const types = route.kind === 'image' ? ['Audio', 'MusicAlbum', 'MusicArtist']
            : route.kind === 'audio' || route.kind === 'lyrics' ? ['Audio'] : ['Audio', 'MusicAlbum', 'MusicArtist'];
        if (!types.includes(data.Type ?? '') && !(route.kind === 'json' && data.CollectionType === 'music')) {
            return new Response(null, { status: 404 });
        }
        if (route.kind === 'json' && !route.params.has('Fields')) return Response.json(data);
    }
    return embyRequest(config, `${path}?${route.params}`, signal, session.token, init);
}

function openNavidrome(config: Config, route: Route, signal: AbortSignal, init: RequestInit): Promise<Response> {
    const salt = randomBytes(12).toString('hex');
    const token = createHash('md5').update(config.password + salt).digest('hex');
    for (const [key, value] of Object.entries({ u: config.username, s: salt, t: token, v: '1.16.1', c: 'Folia', f: 'json' })) {
        route.params.set(key, value);
    }
    if (route.path === '/rest/getUser') route.params.set('username', config.username);
    return fetch(`${config.origin}${route.path}?${route.params}`, { ...init, redirect: 'error', signal });
}

// Bridge the fetch body to Node's pipeline without buffering a track in memory.
async function* mediaChunks(body: NonNullable<Response['body']>): AsyncGenerator<Uint8Array> {
    const reader = body.getReader();
    let complete = false;
    try {
        let next = await reader.read();
        while (!next.done) {
            yield next.value;
            next = await reader.read();
        }
        complete = true;
    } finally {
        if (!complete) await reader.cancel().catch(() => undefined);
        reader.releaseLock();
    }
}

export default async function music(req: IncomingMessage, res: ServerResponse): Promise<void> {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.setHeader('Allow', 'GET, HEAD');
        return sendJson(res, 405, { error: 'method-not-allowed' });
    }
    const controller = new AbortController();
    const disconnect = () => controller.abort();
    res.once('close', disconnect);
    try {
        const config = readMusicConfig(process.env);
        const input = new URL(req.url ?? '/', 'http://localhost').searchParams;
        if (!config || config.platform !== input.get('provider')) return sendJson(res, 404, { error: 'provider-unavailable' });
        const path = input.get('path') ?? '';
        const route = path.length <= 2048 ? resolveMusicRoute(config.platform, path) : null;
        if (!route) return sendJson(res, 404, { error: 'route-unavailable' });
        const headers = new Headers();
        const range = req.headers.range;
        if (route.kind === 'audio' && range && /^bytes=(?:\d{1,16}-\d{0,16}|-\d{1,16})$/.test(range)) headers.set('Range', range);
        const init = { headers, method: req.method === 'HEAD' && route.kind !== 'json' ? 'HEAD' : 'GET' };
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(route.kind === 'audio' ? 290_000 : 15_000)]);
        const response = await (config.platform === 'emby'
            ? openEmby(config, route, signal, init) : openNavidrome(config, route, signal, init));
        if (!response.ok) {
            await response.body?.cancel();
            if (config.platform === 'emby' && response.status === 401) embySession = undefined;
            const status = [401, 403, 404, 416].includes(response.status) ? response.status : 502;
            const contentRange = response.headers.get('content-range');
            if (status === 416 && contentRange && /^bytes \*\/\d+$/.test(contentRange)) res.setHeader('Content-Range', contentRange);
            return sendJson(res, status, { error: 'upstream-unavailable' });
        }
        if (route.kind === 'json') {
            let body: unknown = await response.json();
            if (route.views) {
                const { Items } = body as { Items?: { CollectionType?: string }[] };
                body = { Items: Items?.filter(item => item.CollectionType?.toLowerCase() === 'music') ?? [] };
            }
            return sendJson(res, 200, project(body, config.platform === 'emby' ? embyFields : navFields));
        }
        const type = response.headers.get('content-type')?.split(';', 1)[0] ?? '';
        const isImage = /^image\/(?:jpeg|png|webp|avif|gif|bmp|x-ms-bmp|x-icon)$/i.test(type);
        const isAudio = /^(?:audio\/[\w.+-]+|application\/octet-stream)$/i.test(type);
        if ((route.kind === 'image' && !isImage) || (route.kind === 'audio' && !isAudio)) {
            await response.body?.cancel();
            return sendJson(res, 502, { error: 'unexpected-media-type' });
        }
        if (route.kind === 'image' && response.status === 200) {
            const maxAge = config.platform === 'emby' && route.params.has('tag') ? 3600 : 300;
            res.setHeader('Cache-Control', `private, max-age=${maxAge}`);
        }
        res.statusCode = response.status;
        res.setHeader('Content-Type', route.kind === 'lyrics' ? 'text/plain; charset=utf-8' : type);
        if (!response.headers.has('content-encoding')) {
            for (const name of ['content-length', 'content-range', 'accept-ranges']) {
                const value = response.headers.get(name);
                if (value) res.setHeader(name, value);
            }
        }
        if (!response.body || req.method === 'HEAD') res.end();
        else await pipeline(mediaChunks(response.body), res);
    } catch {
        if (res.destroyed) return;
        if (res.headersSent) res.destroy();
        else sendJson(res, 502, { error: 'upstream-unavailable' });
    } finally {
        res.off('close', disconnect);
    }
}
