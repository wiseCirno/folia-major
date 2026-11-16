import type {EmbySession} from './embySession';
import {rememberLockedEmbyUser} from './embySession';
import {embySubtitleLrcPath, textSubtitleTarget} from './embyLyrics';

// src/services/onlineMusic/emby/embyApi.ts
// Browser calls to one Emby server. Paths follow Emby's own item, audio, and subtitle routes.

export interface EmbyItem {
    Id: string;
    Name: string;
    Type?: string;
    CollectionType?: string;
    ChildCount?: number;
    RunTimeTicks?: number;
    Artists?: string[];
    Album?: string;
    AlbumId?: string;
    AlbumArtist?: string;
    AlbumPrimaryImageTag?: string;
    ImageTags?: { Primary?: string };
    PrimaryImageItemId?: string;
    PrimaryImageTag?: string;
    BackdropImageTags?: string[];
    UserData?: { IsFavorite?: boolean };
}

/** A library root, such as a movie or music folder. Those are not albums or songs. */
export const isEmbyLibraryRoot = (item: Pick<EmbyItem, 'Type' | 'CollectionType'>): boolean => (
    Boolean(item.CollectionType) || item.Type === 'CollectionFolder' || item.Type === 'UserView'
);

/** A library whose collection type is music. Movies and shows are not part of the player. */
export const isEmbyMusicLibrary = (item: Pick<EmbyItem, 'CollectionType'>): boolean => (
    item.CollectionType?.toLowerCase() === 'music'
);

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
    return await fetch(`${session.serverUrl}${path}`, {
        ...init,
        headers: {...authHeader(session.accessToken), ...init?.headers},
    });
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

export const listEmbyMusicLibraries = async (session: EmbySession): Promise<EmbyItem[]> => {
    const response = await request(session, `/Users/${encodeURIComponent(session.userId)}/Views`);
    if (!response.ok) throw new Error('EMBY_NETWORK');
    const body = await response.json() as EmbyItemsResult;
    return (body.Items ?? []).filter(item => item.Id && item.Name && isEmbyMusicLibrary(item));
};

export const listEmbyLibraryAudio = async (
    session: EmbySession,
    libraryId: string,
    limit: number,
    startIndex: number,
): Promise<{ items: EmbyItem[]; total: number }> => {
    const params = new URLSearchParams({
        ParentId: libraryId,
        IncludeItemTypes: 'Audio',
        Recursive: 'true',
        Limit: String(limit),
        StartIndex: String(startIndex),
        Fields: 'UserData',
    });
    const response = await request(session, `/Users/${encodeURIComponent(session.userId)}/Items?${params.toString()}`);
    if (!response.ok) throw new Error('EMBY_NETWORK');
    const body = await response.json() as EmbyItemsResult;
    return { items: body.Items ?? [], total: body.TotalRecordCount ?? body.Items?.length ?? 0 };
};

const readItemList = async (response: Response): Promise<{ items: EmbyItem[]; total: number }> => {
    const body = await response.json() as EmbyItemsResult | EmbyItem[];
    if (Array.isArray(body)) return { items: body, total: body.length };
    return { items: body.Items ?? [], total: body.TotalRecordCount ?? body.Items?.length ?? 0 };
};

const userItems = async (
    session: EmbySession,
    path: string,
    params: Record<string, string>,
): Promise<{ items: EmbyItem[]; total: number }> => {
    const query = new URLSearchParams(params);
    const response = await request(session, `/Users/${encodeURIComponent(session.userId)}${path}?${query.toString()}`);
    if (!response.ok) throw new Error('EMBY_NETWORK');
    return readItemList(response);
};

const IMAGE_FIELDS = 'ImageTags,PrimaryImageItemId,PrimaryImageTag,AlbumPrimaryImageTag,BackdropImageTags,UserData';

const withinMusicLibraries = async (
    session: EmbySession,
    path: string,
    includeItemTypes: string,
    limit: number,
    extra: Record<string, string> = {},
): Promise<{ items: EmbyItem[]; total: number }> => {
    const libraries = await listEmbyMusicLibraries(session);
    const pages = await Promise.all(libraries.map(library => userItems(session, path, {
        IncludeItemTypes: includeItemTypes,
        ParentId: library.Id,
        Recursive: 'true',
        Limit: String(limit),
        Fields: IMAGE_FIELDS,
        ...extra,
    })));
    const items = pages.flatMap(page => page.items).filter(item => !isEmbyLibraryRoot(item));
    return { items: items.slice(0, limit), total: items.length };
};

export const listEmbyAlbums = (session: EmbySession, limit: number, startIndex: number) => withinMusicLibraries(
    session,
    '/Items',
    'MusicAlbum',
    limit,
    { StartIndex: String(startIndex) },
);

export const listEmbyAlbumAudio = (session: EmbySession, albumId: string, limit: number, startIndex: number) => userItems(session, '/Items', {
    ParentId: albumId,
    IncludeItemTypes: 'Audio',
    Limit: String(limit),
    StartIndex: String(startIndex),
    Fields: IMAGE_FIELDS,
});

export const listEmbyLatest = (session: EmbySession, includeItemTypes: string, limit: number) => withinMusicLibraries(
    session,
    '/Items/Latest',
    includeItemTypes,
    limit,
);

export const listEmbySuggestions = async (session: EmbySession, includeItemTypes: string, limit: number) => {
    const result = await userItems(session, '/Suggestions', {
        IncludeItemTypes: includeItemTypes,
        Recursive: 'true',
        Limit: String(limit),
        Fields: IMAGE_FIELDS,
    });
    const items = result.items.filter(item => !isEmbyLibraryRoot(item) && (item.Type === 'Audio' || item.Type === 'MusicAlbum'));
    return { items, total: items.length };
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

const embyPictureUrl = (session: EmbySession, imageId: string, imageType: 'Primary' | 'Backdrop', tag?: string): string => {
    const params = new URLSearchParams({ maxWidth: '600', api_key: session.accessToken });
    if (tag) params.set('tag', tag);
    return `${session.serverUrl}/Items/${encodeURIComponent(imageId)}/Images/${imageType}?${params.toString()}`;
};

/**
 * The picture for one song or album. A tag is used when the list included one.
 * Latest and suggestion lists omit the tag, so a song or album still uses its primary image.
 * Library folders are not given a URL here: requesting one that does not exist stays a gray card.
 */
export const embyImageUrl = (session: EmbySession, item: Pick<EmbyItem, 'Id' | 'Type' | 'AlbumId' | 'ImageTags' | 'PrimaryImageItemId' | 'PrimaryImageTag' | 'AlbumPrimaryImageTag' | 'BackdropImageTags'>): string | undefined => {
    const primaryTag = item.ImageTags?.Primary || item.PrimaryImageTag;
    const albumTag = item.AlbumPrimaryImageTag;
    const backdropTag = item.BackdropImageTags?.[0];
    if (primaryTag) return embyPictureUrl(session, item.PrimaryImageItemId || item.Id, 'Primary', primaryTag);
    if (albumTag && item.AlbumId) return embyPictureUrl(session, item.AlbumId, 'Primary', albumTag);
    if (backdropTag) return embyPictureUrl(session, item.Id, 'Backdrop', backdropTag);
    const fallbackId = item.Type === 'Audio' ? (item.AlbumId || item.Id) : item.Type === 'MusicAlbum' ? item.Id : '';
    return fallbackId ? embyPictureUrl(session, fallbackId, 'Primary') : undefined;
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
