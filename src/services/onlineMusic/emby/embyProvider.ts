import type { SongResult, UnifiedSong } from '@/types.ts';
import type {
    AudioQualityPreference,
    LoginState,
    MediaId,
    OnlineMusicProvider,
    ProviderAudioSource,
    ProviderCollection,
    ProviderLoginForm,
    ProviderLyricsResult,
    ProviderPage,
    ProviderUser,
} from '@/types/onlineMusic.ts';
import { OnlineProviderError } from '@/types/onlineMusic.ts';
import i18n from '@/i18n/config.ts';
import { LyricParserFactory } from '@/utils/lyrics/LyricParserFactory.ts';
import { deploymentLocksPlatform } from '../deploymentLock';
import {
    authenticateEmby,
    embyImageUrl,
    embyStreamUrl,
    ensureEmbyUser,
    getEmbyItem,
    listEmbyAlbumAudio,
    listEmbyAlbums,
    listEmbyLatest,
    listEmbyLibraryAudio,
    listEmbyMusicLibraries,
    listEmbySuggestions,
    readEmbyLyricText,
    searchEmbyAudio,
    setEmbyFavorite,
    type EmbyItem,
} from './embyApi';
import { clearEmbySession, getEmbySession, rememberLockedEmbyToken, rememberLockedEmbyUser, saveEmbySession, type EmbySession } from './embySession';
import { readDeploymentLock } from '../deploymentLock';

// src/services/onlineMusic/emby/embyProvider.ts
// Emby as an Omni platform. The browser talks to the listener's server, or to the one pinned at build time.

const PROVIDER_ID = 'emby';

const requireSession = async (): Promise<EmbySession> => {
    const stored = getEmbySession();
    if (!stored?.serverUrl || !stored.accessToken) {
        throw new OnlineProviderError('auth-required', 'Emby is not configured', PROVIDER_ID);
    }
    return await ensureEmbyUser(stored);
};

const songIdOf = (song: SongResult | MediaId): string => {
    if (typeof song !== 'object' || song === null) return String(song);
    const ref = song.sourceRef;
    if (ref?.kind === 'online' && ref.providerId === PROVIDER_ID) return String(ref.mediaId);
    return String(song.id);
};

const toSong = (session: EmbySession, item: EmbyItem): UnifiedSong => {
    if (!item.Id || !item.Name) {
        throw new OnlineProviderError('invalid-response', 'Emby item is missing an id', PROVIDER_ID);
    }
    const artists = (item.Artists?.length ? item.Artists : ['']).map(name => ({ id: 0, name }));
    return {
        id: item.Id,
        name: item.Name,
        artists,
        album: { id: item.AlbumId || 0, name: item.Album || '', coverUrl: embyImageUrl(session, item) },
        durationMs: Math.round((item.RunTimeTicks ?? 0) / 10000),
        sourceRef: { kind: 'online', providerId: PROVIDER_ID, mediaId: item.Id },
    };
};

const albumCollection = (session: EmbySession, item: EmbyItem): ProviderCollection => ({
    providerId: PROVIDER_ID,
    id: item.Id,
    name: item.Name,
    type: 'album',
    trackCount: item.ChildCount,
    coverUrl: embyImageUrl(session, item),
    creator: item.AlbumArtist ? { id: 0, nickname: item.AlbumArtist } : undefined,
});

const pageOf = <T>(items: T[], total: number, offset: number): ProviderPage<T> => ({
    items,
    total,
    hasMore: offset + items.length < total,
    nextOffset: offset + items.length,
});

const userFrom = (session: EmbySession): ProviderUser => ({
    id: session.userId || session.username,
    nickname: session.username,
});

const locked = (): boolean => deploymentLocksPlatform(PROVIDER_ID);

export const embyProvider: OnlineMusicProvider = {
    id: PROVIDER_ID,
    displayName: 'Emby',
    shortName: 'Emby',
    shortNameKey: 'emby.title',
    mark: { letter: 'E', color: '#52b54b' },
    getAvailability: () => ({ configured: Boolean(getEmbySession()?.serverUrl && getEmbySession()?.accessToken) }),
    capabilities: {
        search: true,
        playback: true,
        lyrics: true,
        auth: true,
        userLibrary: true,
        playlists: true,
        albums: false,
        artists: false,
        recommendations: true,
        mutations: true,
        wordByWordLyrics: false,
        likes: true,
        userAlbums: true,
        explore: true,
        playlistTrackMutations: false,
        playbackReports: false,
        songDetail: true,
    },
    normalizeSong: raw => {
        const item = raw as Partial<EmbyItem> & Partial<UnifiedSong>;
        if (item.sourceRef?.kind === 'online' && item.sourceRef.providerId === PROVIDER_ID && item.name) {
            return item as UnifiedSong;
        }
        const session = getEmbySession();
        if (!session || !item.Id || !item.Name) {
            throw new OnlineProviderError('invalid-response', 'Emby song is missing an id', PROVIDER_ID);
        }
        return toSong(session, { Id: item.Id, Name: item.Name });
    },
    search: {
        async searchSongs(query, limit, offset) {
            const trimmed = query.trim();
            if (!trimmed) return pageOf([], 0, offset);
            const session = await requireSession();
            const result = await searchEmbyAudio(session, trimmed, limit, offset);
            return pageOf(result.items.map(item => toSong(session, item)), result.total, offset);
        },
    },
    playback: {
        audioQualityLevels: ['standard'],
        async getSongDetail(id) {
            const session = await requireSession();
            const item = await getEmbyItem(session, String(id));
            return item ? toSong(session, item) : null;
        },
        async getAudioSource(song, quality: AudioQualityPreference): Promise<ProviderAudioSource | null> {
            const session = await requireSession();
            return { url: embyStreamUrl(session, songIdOf(song)), fetchedAt: Date.now(), quality };
        },
    },
    lyrics: {
        async getLyrics(song): Promise<ProviderLyricsResult> {
            const session = await requireSession();
            const text = await readEmbyLyricText(session, songIdOf(song));
            if (!text?.trim()) return { lyrics: null, isPureMusic: false };
            const lyrics = await LyricParserFactory.parse({ type: 'local', lrcContent: text });
            return { lyrics, isPureMusic: false };
        },
    },
    library: {
        async getUserPlaylists(_userId, limit, offset) {
            const session = await requireSession();
            const libraries = await listEmbyMusicLibraries(session);
            const items = libraries.map((library): ProviderCollection => ({
                providerId: PROVIDER_ID,
                id: library.Id,
                name: library.Name,
                type: 'playlist',
                trackCount: library.ChildCount,
                coverUrl: embyImageUrl(session, library),
            }));
            return pageOf(items.slice(offset, offset + limit), items.length, offset);
        },
        async getUserAlbums(_userId, limit, offset) {
            const session = await requireSession();
            const result = await listEmbyAlbums(session, limit, offset);
            return pageOf(result.items.map(item => albumCollection(session, item)), result.total, offset);
        },
    },
    catalog: {
        async getPlaylistTracks(id, limit, offset) {
            const session = await requireSession();
            const result = await listEmbyLibraryAudio(session, String(id), limit, offset);
            return pageOf(result.items.map(item => toSong(session, item)), result.total, offset);
        },
        async getAlbumTracks(id, limit = 500, offset = 0) {
            const session = await requireSession();
            const result = await listEmbyAlbumAudio(session, String(id), limit, offset);
            return pageOf(result.items.map(item => toSong(session, item)), result.total, offset);
        },
        async getAlbumDetail(id) {
            const session = await requireSession();
            const item = await getEmbyItem(session, String(id));
            return item?.Id && item.Name ? albumCollection(session, item) : null;
        },
    },
    recommendations: {
        async getDailySongs() {
            const session = await requireSession();
            const suggested = await listEmbySuggestions(session, 'Audio', 30);
            const items = suggested.items.length > 0 ? suggested.items : (await listEmbyLatest(session, 'Audio', 30)).items;
            return items.map(item => toSong(session, item));
        },
    },
    explore: {
        async getFeed() {
            const session = await requireSession();
            const [latestSongs, latestAlbums, suggestions] = await Promise.all([
                listEmbyLatest(session, 'Audio', 12),
                listEmbyLatest(session, 'MusicAlbum', 12),
                listEmbySuggestions(session, 'Audio', 12),
            ]);
            const sections = [
                { id: 'latest-songs', title: i18n.t('emby.latestSongs'), items: latestSongs.items.map(item => ({ kind: 'song' as const, song: toSong(session, item) })) },
                { id: 'latest-albums', title: i18n.t('emby.latestAlbums'), items: latestAlbums.items.map(item => ({ kind: 'collection' as const, collection: albumCollection(session, item) })) },
                { id: 'suggestions', title: i18n.t('emby.suggestions'), items: suggestions.items.map(item => ({ kind: 'song' as const, song: toSong(session, item) })) },
            ].filter(section => section.items.length > 0);
            return { sections, refreshReadsAnew: true };
        },
        async songsShownAs(songs) {
            const session = getEmbySession();
            const answers = new Map<string, UnifiedSong | null>();
            if (!session?.accessToken) return answers;
            for (const song of songs) {
                const id = String(song.id);
                if (song.album?.coverUrl) {
                    answers.set(id, null);
                    continue;
                }
                const albumId = song.album?.id ? String(song.album.id) : '';
                const coverUrl = embyImageUrl(session, {
                    Id: songIdOf(song),
                    Type: 'Audio',
                    AlbumId: albumId && albumId !== '0' ? albumId : undefined,
                });
                answers.set(id, coverUrl ? { ...song, album: { ...song.album, id: song.album?.id || 0, name: song.album?.name || '', coverUrl } } : null);
            }
            return answers;
        },
    },
    mutations: {
        async likeSong(song, liked) {
            const session = await requireSession();
            await setEmbyFavorite(session, songIdOf(song), liked);
        },
    },
    auth: {
        showsKeptAccountAtStart: true,
        getLoginTexts: () => ({ title: 'emby.settings', note: locked() ? 'emby.lockedNote' : 'emby.loginNote' }),
        ...(locked() ? {} : {
            getLoginForm: (): ProviderLoginForm => ({
                fields: [
                    { key: 'serverUrl', type: 'url', labelKey: 'emby.serverUrl', placeholderKey: 'emby.serverUrlPlaceholder', required: true },
                    { key: 'username', type: 'text', labelKey: 'emby.username', required: true },
                    { key: 'password', type: 'password', labelKey: 'emby.password', required: true },
                ],
                submitLabelKey: 'emby.login',
                noteKey: 'emby.loginNote',
                errorKeys: {
                    'auth-required': 'emby.errorBadCredentials',
                    network: 'emby.errorNetwork',
                    unavailable: 'emby.errorBadServerUrl',
                },
            }),
        }),
        async submitLoginForm(values) {
            if (locked()) return;
            const serverUrl = values.serverUrl?.trim().replace(/\/+$/, '') ?? '';
            const username = values.username?.trim() ?? '';
            const password = values.password ?? '';
            if (!/^https?:\/\//i.test(serverUrl)) {
                throw new OnlineProviderError('unavailable', 'Emby server URL is invalid', PROVIDER_ID);
            }
            if (!username || !password) {
                throw new OnlineProviderError('auth-required', 'Emby username and password are required', PROVIDER_ID);
            }
            try {
                const session = await authenticateEmby(serverUrl, username, password);
                saveEmbySession(session);
            } catch (error) {
                const code = error instanceof Error && error.message === 'EMBY_AUTH' ? 'auth-required' : 'network';
                throw new OnlineProviderError(code, 'Emby sign-in failed', PROVIDER_ID);
            }
        },
        async getLoginStatus() {
            if (locked()) {
                const lock = readDeploymentLock();
                const current = getEmbySession();
                if (lock && current && !current.accessToken && lock.username && lock.password) {
                    try {
                        const signedIn = await authenticateEmby(lock.serverUrl, lock.username, lock.password);
                        rememberLockedEmbyToken(signedIn.accessToken);
                        rememberLockedEmbyUser(signedIn.userId, signedIn.username);
                    } catch (error) {
                        console.warn('[Emby] locked sign-in failed', error);
                        return null;
                    }
                }
            }
            const stored = getEmbySession();
            if (!stored?.serverUrl || !stored.accessToken) return null;
            try {
                const session = await ensureEmbyUser(stored);
                return userFrom(session);
            } catch (error) {
                console.warn('[Emby] session was not confirmed', error);
                return null;
            }
        },
        async logout() {
            clearEmbySession();
        },
        async startLogin(): Promise<string> {
            throw new OnlineProviderError('auth-required', 'Emby signs in with the server form', PROVIDER_ID);
        },
        async checkLogin(): Promise<LoginState> {
            return getEmbySession() ? { state: 'confirmed' } : { state: 'error' };
        },
    },
};
