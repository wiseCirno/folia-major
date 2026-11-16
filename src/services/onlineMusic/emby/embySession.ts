import { deploymentLocksPlatform, readDeploymentLock } from '../deploymentLock';

// src/services/onlineMusic/emby/embySession.ts
// The signed-in Emby server. A deployment lock is read from the build and is not written to disk.

const STORAGE_KEY = 'emby_session';

let lockedUserId = '';
let lockedUsername = '';
let lockedAccessToken = '';

/** Remembers which Emby user an API key should read. The key itself stays in the build env. */
export const rememberLockedEmbyUser = (userId: string, username: string): void => {
    lockedUserId = userId;
    lockedUsername = username;
};

/** Keeps a username-and-password sign-in for this page load. The password is not written down. */
export const rememberLockedEmbyToken = (accessToken: string): void => {
    lockedAccessToken = accessToken;
};

export interface EmbySession {
    serverUrl: string;
    userId: string;
    username: string;
    accessToken: string;
    /** True when the token came from the build, so sign-out cannot drop it. */
    locked: boolean;
}

const parseStored = (raw: string | null): EmbySession | null => {
    if (!raw) return null;
    try {
        const value = JSON.parse(raw) as Partial<EmbySession>;
        if (!value.serverUrl || !value.userId || !value.accessToken || !value.username) return null;
        return {
            serverUrl: value.serverUrl.replace(/\/+$/, ''),
            userId: value.userId,
            username: value.username,
            accessToken: value.accessToken,
            locked: false,
        };
    } catch (error) {
        console.warn('[Emby] stored session was not read', error);
        return null;
    }
};

/** The session to use now. A locked build wins over anything saved in the browser. */
export const getEmbySession = (): EmbySession | null => {
    if (deploymentLocksPlatform('emby')) {
        const lock = readDeploymentLock();
        if (!lock) return null;
        return {
            serverUrl: lock.serverUrl,
            userId: lockedUserId,
            username: lock.username || lockedUsername || 'Emby',
            accessToken: lock.apiKey || lockedAccessToken,
            locked: true,
        };
    }
    return parseStored(localStorage.getItem(STORAGE_KEY));
};

export const saveEmbySession = (session: Omit<EmbySession, 'locked'>): void => {
    if (deploymentLocksPlatform('emby')) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

export const clearEmbySession = (): void => {
    if (deploymentLocksPlatform('emby')) return;
    localStorage.removeItem(STORAGE_KEY);
};
