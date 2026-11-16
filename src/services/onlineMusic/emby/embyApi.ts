import type { EmbySession } from './embySession';
import { rememberLockedEmbyUser } from './embySession';
import { embySubtitleLrcPath, textSubtitleTarget } from './embyLyrics';

// src/services/onlineMusic/emby/embyApi.ts
// Browser calls to one Emby server. Paths follow Emby's own item, audio, and subtitle routes.

export interface EmbyItem {
    Id: string;
    Name: string;
    Type?: string;
    RunTimeTicks?: number;
    Artists?: string[];
    Album?: string;
    AlbumId?: string;
    UserData?: { IsFavorite?: boolean };
}

interface EmbyItemsResult {
    Items?: EmbyItem[];
    TotalRecordCount?: number;
}

interface EmbyUser {
    Id?: string;
    Name?: string;
    Policy?: { IsDisabled?: boolean };
}

const authHeader = (token?: string): HeadersInit => ({
    'Content-Type': 'application/json',
    'X-Emby-Authorization': 'MediaBrowser Client="Folia", Device="Web", DeviceId="folia-web", Version="1"',
    ...(token ? { 'X-Emby-Token': token } : {}),
});

const request = async (session: Pick<EmbySession, 'serverUrl' | 'accessToken'>, path: string, init?: RequestInit): Promise<Response> => {
    const response = await fetch(`${session.serverUrl}${path}`, {
        ...init,
        headers: { ...authHeader(session.accessToken), ...init?.headers },
    });
    return response;
};

export const authenticateEmby = async (
    serverUrl: string,
    username: string,
    password: string,
): Promise<EmbySession> => {
    const response = await fetch(`${serverUrl}/Users/AuthenticateByName`, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ Username: username, Pw: password }),
    });
    if (response.status === 401) throw new Error('EMBY_AUTH');
    if (!response.ok) throw new Error('EMBY_NETWORK');
    const body = await response.json() as { AccessToken?: string; User?: { Id?: string; Name?: string } };
    if (!body.AccessToken || !body.User?.Id) throw new Error('EMBY_AUTH');
    return {
        serverUrl,
        userId: body.User.Id,
        username: body.User.Name || username,
        accessToken: body.AccessToken,
        locked: false,
    };
};

const rememberUser = (session: EmbySession, user: EmbyUser): EmbySession => {
    const next = { ...session, userId: user.Id ?? '', username: user.Name || session.username };
    if (next.userId && next.locked) rememberLockedEmbyUser(next.userId, next.username);
    return next;
};

/** An API key has no user of its own. The first enabled user is the library the player reads. */
export const ensureEmbyUser = async (session: EmbySession): Promise<EmbySession> => {
    if (session.userId) return session;
    const response = await request(session, '/Users');
    if (!response.ok) throw new Error('EMBY_NETWORK');
    const users = await response.json() as EmbyUser[];
    const user = users.find(item => item.Id && item.Policy?.IsDisabled !== true);
    if (!user?.Id) throw new Error('EMBY_AUTH');
    return rememberUser(session, user);
};

export const searchEmbyAudio = async (
    session: EmbySession,
    term: string,
    limit: number,
    startIndex: number,
): Promise<{ items: EmbyItem[]; total: number }> => {
    const params = new URLSearchParams({
        IncludeItemTypes: 'Audio',
        Recursive: 'true',
        SearchTerm: term,
        Limit: String(limit),
        StartIndex: String(startIndex),
        Fields: 'UserData',
    });
    const response = await request(session, `/Users/${encodeURIComponent(session.userId)}/Items?${params.toString()}`);
    if (!response.ok) throw new Error('EMBY_NETWORK');
    const body = await response.json() as EmbyItemsResult;
    return { items: body.Items ?? [], total: body.TotalRecordCount ?? body.Items?.length ?? 0 };
};

export const getEmbyItem = async (session: EmbySession, itemId: string): Promise<EmbyItem | null> => {
    const response = await request(session, `/Users/${encodeURIComponent(session.userId)}/Items/${encodeURIComponent(itemId)}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('EMBY_NETWORK');
    return await response.json() as EmbyItem;
};

export const embyStreamUrl = (session: EmbySession, itemId: string): string => {
    const params = new URLSearchParams({ static: 'true', api_key: session.accessToken });
    return `${session.serverUrl}/Audio/${encodeURIComponent(itemId)}/stream?${params.toString()}`;
};

export const embyImageUrl = (session: EmbySession, itemId: string): string => {
    const params = new URLSearchParams({ maxWidth: '600', api_key: session.accessToken });
    return `${session.serverUrl}/Items/${encodeURIComponent(itemId)}/Images/Primary?${params.toString()}`;
};

export const readEmbyLyricText = async (session: EmbySession, itemId: string): Promise<string | null> => {
    const response = await request(
        session,
        `/Users/${encodeURIComponent(session.userId)}/Items/${encodeURIComponent(itemId)}?Fields=MediaSources`,
    );
    if (!response.ok) return null;
    const body = await response.json() as { MediaSources?: { Id?: string; MediaStreams?: { Index?: number; Type?: string; IsTextSubtitleStream?: boolean }[] }[] };
    const target = textSubtitleTarget(body.MediaSources);
    if (!target) return null;
    const lyric = await request(session, embySubtitleLrcPath(itemId, target));
    if (!lyric.ok) return null;
    return await lyric.text();
};

export const setEmbyFavorite = async (session: EmbySession, itemId: string, liked: boolean): Promise<void> => {
    const path = `/Users/${encodeURIComponent(session.userId)}/FavoriteItems/${encodeURIComponent(itemId)}`;
    const response = await request(session, path, { method: liked ? 'POST' : 'DELETE' });
    if (!response.ok) throw new Error('EMBY_NETWORK');
};
