import type { SongResult, UnifiedSong } from '../../../types';
import type {
    AudioQualityPreference,
    LoginState,
    MediaId,
    OnlineMusicProvider,
    ProviderAudioSource,
    ProviderCollection,
    ProviderLikedSongIds,
    ProviderLyricsResult,
    ProviderPage,
    ProviderPlaybackReport,
    ProviderUser,
} from '../../../types/onlineMusic';
import { OnlineProviderError } from '../../../types/onlineMusic';
import type { NavidromeConfig, SubsonicAlbum, SubsonicArtist, SubsonicPlaylist, SubsonicSong } from '../../../types/navidrome';
import { LyricParserFactory } from '../../../utils/lyrics/LyricParserFactory';
import {
    clearNavidromeConfig,
    dismissNavidromeServerPreset,
    getCachedNavidromeServerProfile,
    getNavidromeConfig,
    hashPassword,
    navidromeAccountId,
    navidromeApi,
    refreshNavidromeServerProfile,
    saveNavidromeConfig,
    setNavidromeEnabled,
} from '../../navidromeService';

// src/services/onlineMusic/navidrome/navidromeProvider.ts
// Navidrome 作为 Omni 平台：浏览器直连用户自己的 Subsonic 服务器。凭据仍只经过 navidromeService 里已有的写入。

const PROVIDER_ID = 'navidrome';

const requireConfig = (): NavidromeConfig => {
    const config = getNavidromeConfig();
    if (!config?.serverUrl || !config.username || !config.passwordHash) {
        throw new OnlineProviderError('auth-required', 'Navidrome is not configured', PROVIDER_ID);
    }
    return config;
};

const songIdOf = (song: SongResult): string => {
    const dataId = (song as { navidromeData?: { id?: string } }).navidromeData?.id;
    if (dataId) return dataId;
    const source = song.sourceRef;
    if (source?.kind === 'online' && source.providerId === PROVIDER_ID) return String(source.mediaId);
    if (source?.kind === 'navidrome') return String(source.mediaId);
    throw new OnlineProviderError('unsupported', 'Song does not belong to Navidrome', PROVIDER_ID);
};

const trackIdOf = (track: MediaId | SongResult): string => (
    typeof track === 'object' ? songIdOf(track) : String(track)
);

const pageOf = <T>(items: T[], total: number, offset: number): ProviderPage<T> => ({
    items,
    total,
    hasMore: offset + items.length < total,
    nextOffset: offset + items.length,
});

const slicePage = <T>(items: T[], limit: number, offset: number): ProviderPage<T> => (
    pageOf(items.slice(offset, offset + limit), items.length, offset)
);

const coverUrl = (config: NavidromeConfig, coverArt?: string): string => (
    coverArt ? navidromeApi.getCoverArtUrl(config, coverArt, 600) : ''
);

const albumCollection = (config: NavidromeConfig, album: SubsonicAlbum): ProviderCollection => ({
    providerId: PROVIDER_ID,
    id: album.id,
    type: 'album',
    name: album.name,
    coverUrl: coverUrl(config, album.coverArt),
    description: album.artist,
    trackCount: album.songCount,
    artists: album.artistId && album.artist ? [{ id: album.artistId, name: album.artist }] : undefined,
});

const playlistCollection = (config: NavidromeConfig, playlist: SubsonicPlaylist): ProviderCollection => ({
    providerId: PROVIDER_ID,
    id: playlist.id,
    type: 'playlist',
    name: playlist.name,
    coverUrl: coverUrl(config, playlist.coverArt),
    description: playlist.comment || '',
    trackCount: playlist.songCount,
    isOwned: true,
});

const artistCollection = (config: NavidromeConfig, artist: SubsonicArtist): ProviderCollection => ({
    providerId: PROVIDER_ID,
    id: artist.id,
    type: 'artist',
    name: artist.name,
    coverUrl: coverUrl(config, artist.coverArt),
    albumCount: artist.albumCount,
});

/** 把 Subsonic 歌曲收成带播放载体的统一歌曲，专辑和歌手可以点开。 */
export const normalizeNavidromeSong = (raw: unknown): UnifiedSong => {
    const item = raw as Partial<SubsonicSong> & Partial<UnifiedSong> & { navidromeData?: { id?: string } };
    if (item?.sourceRef?.kind === 'online' && item.sourceRef.providerId === PROVIDER_ID && item.navidromeData?.id) {
        return item as UnifiedSong;
    }
    if (item?.isNavidrome && item.navidromeData?.id) {
        return {
            ...(item as UnifiedSong),
            sourceRef: { kind: 'online', providerId: PROVIDER_ID, mediaId: item.navidromeData.id },
        };
    }
    if (!item || typeof item.id !== 'string' || !item.title) {
        throw new OnlineProviderError('invalid-response', 'Navidrome song is missing an id', PROVIDER_ID);
    }
    const config = requireConfig();
    const song = navidromeApi.toNavidromeSong(config, item as SubsonicSong);
    if (item.artistId && item.artist) {
        song.artists = [{
            id: item.artistId,
            name: item.artist,
            catalogRef: { providerId: PROVIDER_ID, kind: 'artist', id: item.artistId },
        }];
    }
    if (item.albumId) {
        song.album = {
            ...song.album,
            id: item.albumId,
            catalogRef: { providerId: PROVIDER_ID, kind: 'album', id: item.albumId },
        };
    }
    return song as UnifiedSong;
};

const songsFrom = (songs: SubsonicSong[] | undefined, offset: number, limit: number): ProviderPage<UnifiedSong> => {
    const page = (songs ?? []).slice(offset, offset + limit).map(song => normalizeNavidromeSong(song));
    return pageOf(page, songs?.length ?? page.length, offset);
};

const userFromConfig = (config: NavidromeConfig): ProviderUser => ({
    id: navidromeAccountId(config),
    nickname: config.username,
});

const readArtistSongs = async (config: NavidromeConfig, id: string): Promise<SubsonicSong[]> => {
    const artist = await navidromeApi.getArtist(config, id);
    if (!artist) throw new OnlineProviderError('invalid-response', 'Navidrome artist was not read', PROVIDER_ID);
    const albums = await Promise.all((artist.album ?? []).map(album => navidromeApi.getAlbum(config, album.id)));
    if (albums.some(album => !album)) {
        throw new OnlineProviderError('invalid-response', 'Navidrome artist albums were not read', PROVIDER_ID);
    }
    return albums.flatMap(album => album?.song ?? []);
};

export const navidromeProvider: OnlineMusicProvider = {
    id: PROVIDER_ID,
    displayName: 'Navidrome',
    shortName: 'Navidrome',
    shortNameKey: 'navidrome.title',
    mark: { letter: 'N', color: '#3d7eea' },
    getAvailability: () => ({ configured: Boolean(getNavidromeConfig()?.serverUrl && getNavidromeConfig()?.username) }),
    capabilities: {
        search: true,
        playback: true,
        lyrics: true,
        auth: true,
        userLibrary: true,
        playlists: true,
        albums: true,
        artists: true,
        recommendations: false,
        mutations: true,
        wordByWordLyrics: false,
        likes: true,
        userAlbums: true,
        playlistTrackMutations: true,
        playbackReports: true,
        songDetail: true,
    },
    normalizeSong: normalizeNavidromeSong,
    search: {
        async searchSongs(query, limit, offset) {
            const trimmed = query.trim();
            if (!trimmed) return pageOf([], 0, offset);
            const config = requireConfig();
            const result = await navidromeApi.search(config, trimmed, 0, 0, limit, { songOffset: offset, strict: true });
            const songs = result.song ?? [];
            return {
                items: songs.map(song => normalizeNavidromeSong(song)),
                hasMore: songs.length === limit,
                nextOffset: offset + songs.length,
            };
        },
        async searchAlbums(query, limit, offset) {
            const trimmed = query.trim();
            if (!trimmed) return pageOf([], 0, offset);
            const config = requireConfig();
            const result = await navidromeApi.search(config, trimmed, 0, limit, 0, { albumOffset: offset, strict: true });
            const albums = result.album ?? [];
            return {
                items: albums.map(album => albumCollection(config, album)),
                hasMore: albums.length === limit,
                nextOffset: offset + albums.length,
            };
        },
    },
    playback: {
        audioQualityLevels: ['standard'],
        async getSongDetail(id) {
            const config = requireConfig();
            const song = await navidromeApi.getSong(config, String(id));
            return song ? normalizeNavidromeSong(song) : null;
        },
        async getAudioSource(song, quality: AudioQualityPreference): Promise<ProviderAudioSource | null> {
            const config = requireConfig();
            const id = songIdOf(song);
            const stored = (song as { navidromeData?: { replayGain?: ProviderAudioSource['replayGain'] } }).navidromeData?.replayGain;
            return {
                url: navidromeApi.getStreamUrl(config, id),
                fetchedAt: Date.now(),
                quality,
                ...(stored ? { replayGain: stored } : {}),
            };
        },
    },
    playbackReports: {
        canReport: song => {
            try {
                songIdOf(song);
                return Boolean(getNavidromeConfig());
            } catch {
                return false;
            }
        },
        async reportPlayback(song, report: ProviderPlaybackReport) {
            const config = getNavidromeConfig();
            if (!config) return;
            await navidromeApi.scrobble(config, songIdOf(song), {
                submission: report.playedSeconds > 0,
            });
        },
    },
    lyrics: {
        async getLyrics(song): Promise<ProviderLyricsResult> {
            const config = requireConfig();
            const id = songIdOf(song);
            const profile = getCachedNavidromeServerProfile();
            const structured = profile?.capabilities.supportsSongLyrics === false
                ? null
                : await navidromeApi.getLyricsBySongId(config, id);
            if (structured?.length) {
                const lyrics = await LyricParserFactory.parse({ type: 'navidrome', structuredLyrics: structured });
                return { lyrics, isPureMusic: false };
            }
            const artist = song.artists?.[0]?.name ?? '';
            const plain = await navidromeApi.getLyrics(config, artist, song.name);
            if (!plain?.trim()) return { lyrics: null, isPureMusic: false };
            const lyrics = await LyricParserFactory.parse({ type: 'navidrome', plainLyrics: plain });
            return { lyrics, mainText: plain, isPureMusic: false };
        },
    },
    library: {
        async getUserPlaylists(_userId, limit, offset) {
            const config = requireConfig();
            const playlists = await navidromeApi.getPlaylists(config, true);
            return slicePage(playlists.map(playlist => playlistCollection(config, playlist)), limit, offset);
        },
        async getLikedSongIds(): Promise<ProviderLikedSongIds> {
            const config = requireConfig();
            const songs = await navidromeApi.getStarred2(config);
            if (!songs) throw new OnlineProviderError('invalid-response', 'Navidrome starred songs were not read', PROVIDER_ID);
            return { ids: songs.map(song => song.id), whole: true };
        },
        async getUserAlbums(_userId, limit, offset) {
            const config = requireConfig();
            const albums = await navidromeApi.getAlbumList2(config, 'alphabeticalByName', limit, offset, true);
            return {
                items: albums.map(album => albumCollection(config, album)),
                hasMore: albums.length === limit,
                nextOffset: offset + albums.length,
            };
        },
    },
    catalog: {
        async getPlaylistTracks(id, limit, offset) {
            const config = requireConfig();
            const playlist = await navidromeApi.getPlaylist(config, String(id));
            if (!playlist) throw new OnlineProviderError('invalid-response', 'Navidrome playlist was not read', PROVIDER_ID);
            return songsFrom(playlist.entry, offset, limit);
        },
        async getPlaylistDetail(id) {
            const config = requireConfig();
            const playlist = await navidromeApi.getPlaylist(config, String(id));
            return playlist ? playlistCollection(config, playlist) : null;
        },
        async getAlbumTracks(id, limit = 500, offset = 0) {
            const config = requireConfig();
            const album = await navidromeApi.getAlbum(config, String(id));
            if (!album) throw new OnlineProviderError('invalid-response', 'Navidrome album was not read', PROVIDER_ID);
            return songsFrom(album.song, offset, limit);
        },
        async getAlbumDetail(id) {
            const config = requireConfig();
            const album = await navidromeApi.getAlbum(config, String(id));
            return album ? albumCollection(config, album) : null;
        },
        async getArtistSongs(id, limit, offset) {
            const config = requireConfig();
            return songsFrom(await readArtistSongs(config, String(id)), offset, limit);
        },
        async getArtistAlbums(id, limit, offset) {
            const config = requireConfig();
            const artist = await navidromeApi.getArtist(config, String(id));
            if (!artist) throw new OnlineProviderError('invalid-response', 'Navidrome artist was not read', PROVIDER_ID);
            return slicePage((artist.album ?? []).map(album => albumCollection(config, album)), limit, offset);
        },
        async getArtistDetail(id) {
            const config = requireConfig();
            const artist = await navidromeApi.getArtist(config, String(id));
            return artist ? artistCollection(config, artist) : null;
        },
    },
    mutations: {
        async likeSong(song, liked) {
            const config = requireConfig();
            const id = trackIdOf(song);
            const ok = liked ? await navidromeApi.star(config, id) : await navidromeApi.unstar(config, id);
            if (!ok) throw new OnlineProviderError('invalid-response', 'Navidrome star was not saved', PROVIDER_ID);
        },
        async updatePlaylistTracks(operation, playlist, tracks) {
            const config = requireConfig();
            const playlistId = typeof playlist === 'object' ? String(playlist.id) : String(playlist);
            const ids = tracks.map(track => trackIdOf(track));
            if (operation === 'add') {
                const ok = await navidromeApi.updatePlaylist(config, playlistId, { songIdsToAdd: ids });
                if (!ok) throw new OnlineProviderError('invalid-response', 'Navidrome playlist was not updated', PROVIDER_ID);
                return;
            }
            const detail = await navidromeApi.getPlaylist(config, playlistId);
            if (!detail?.entry) throw new OnlineProviderError('invalid-response', 'Navidrome playlist was not read', PROVIDER_ID);
            const remove = new Set(ids);
            const songIndexesToRemove = detail.entry.flatMap((entry, index) => remove.has(entry.id) ? [index] : []);
            if (songIndexesToRemove.length === 0) return;
            const ok = await navidromeApi.updatePlaylist(config, playlistId, { songIndexesToRemove });
            if (!ok) throw new OnlineProviderError('invalid-response', 'Navidrome playlist was not updated', PROVIDER_ID);
        },
        async createPlaylist(name) {
            const config = requireConfig();
            const playlist = await navidromeApi.createPlaylist(config, name);
            if (!playlist) throw new OnlineProviderError('invalid-response', 'Navidrome playlist was not created', PROVIDER_ID);
            return playlistCollection(config, playlist);
        },
    },
    auth: {
        showsKeptAccountAtStart: true,
        getLoginTexts: () => ({ title: 'navidrome.settings', note: 'navidrome.loginNote' }),
        getLoginForm: () => ({
            fields: [
                { key: 'serverUrl', type: 'url', labelKey: 'navidrome.serverUrl', placeholderKey: 'navidrome.serverUrlPlaceholder', required: true },
                { key: 'username', type: 'text', labelKey: 'navidrome.username', required: true },
                { key: 'password', type: 'password', labelKey: 'navidrome.password', required: true },
            ],
            submitLabelKey: 'navidrome.login',
            noteKey: 'navidrome.loginNote',
            errorKeys: {
                'auth-required': 'navidrome.errorBadCredentials',
                network: 'navidrome.errorNetwork',
                unavailable: 'navidrome.errorBadServerUrl',
            },
        }),
        async submitLoginForm(values) {
            const serverUrl = values.serverUrl?.trim().replace(/\/+$/, '') ?? '';
            const username = values.username?.trim() ?? '';
            const password = values.password ?? '';
            if (!/^https?:\/\//i.test(serverUrl)) {
                throw new OnlineProviderError('unavailable', 'Navidrome server URL is invalid', PROVIDER_ID);
            }
            if (!username || !password) {
                throw new OnlineProviderError('auth-required', 'Navidrome username and password are required', PROVIDER_ID);
            }
            const config: NavidromeConfig = { serverUrl, username, passwordHash: hashPassword(password) };
            const ok = await navidromeApi.ping(config);
            if (!ok) throw new OnlineProviderError('network', 'Navidrome server did not answer', PROVIDER_ID);
            saveNavidromeConfig(config);
            setNavidromeEnabled(true);
            void refreshNavidromeServerProfile(config).catch(error => {
                console.warn('[Navidrome] server profile was not refreshed after login', error);
            });
        },
        async getLoginStatus() {
            const config = getNavidromeConfig();
            if (!config?.serverUrl || !config.username) return null;
            return userFromConfig(config);
        },
        async logout() {
            clearNavidromeConfig();
            setNavidromeEnabled(false);
            dismissNavidromeServerPreset();
        },
        async startLogin(): Promise<string> {
            throw new OnlineProviderError('auth-required', 'Navidrome signs in with the server form', PROVIDER_ID);
        },
        async checkLogin(): Promise<LoginState> {
            return getNavidromeConfig() ? { state: 'confirmed' } : { state: 'error' };
        },
    },
};
