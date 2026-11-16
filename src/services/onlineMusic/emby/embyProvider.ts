import type { SongResult, UnifiedSong } from '../../../types';
import type {
    AudioQualityPreference,
    LoginState,
    MediaId,
    OnlineMusicProvider,
    ProviderAudioSource,
    ProviderLoginForm,
    ProviderLyricsResult,
    ProviderPage,
    ProviderUser,
} from '../../../types/onlineMusic';
import { OnlineProviderError } from '../../../types/onlineMusic';
import { LyricParserFactory } from '../../../utils/lyrics/LyricParserFactory';
import { deploymentLocksPlatform } from '../deploymentLock';
import {
    authenticateEmby,
    embyImageUrl,
    embyStreamUrl,
    ensureEmbyUser,
    getEmbyItem,
    readEmbyLyricText,
    searchEmbyAudio,
    setEmbyFavorite,
    type EmbyItem,
} from './embyApi';
import { clearEmbySession, getEmbySession, saveEmbySession, type EmbySession } from './embySession';

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
        album: { id: item.AlbumId || 0, name: item.Album || '', coverUrl: embyImageUrl(session, item.Id) },
        durationMs: Math.round((item.RunTimeTicks ?? 0) / 10000),
        sourceRef: { kind: 'online', providerId: PROVIDER_ID, mediaId: item.Id },
    };
};

const pageOf = (items: UnifiedSong[], total: number, offset: number): ProviderPage<UnifiedSong> => ({
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
        userLibrary: false,
        playlists: false,
        albums: false,
        artists: false,
        recommendations: false,
        mutations: true,
        wordByWordLyrics: false,
        likes: true,
        userAlbums: false,
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
            const stored = getEmbySession();
            if (!stored?.serverUrl || !stored.accessToken) return null;
            try {
                const session = await ensureEmbyUser(stored);
                return userFrom(session);
            } catch (error) {
                console.warn('[Emby] session was not confirmed', error);
                return locked() ? userFrom(stored) : null;
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
