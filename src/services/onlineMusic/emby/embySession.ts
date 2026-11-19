import { deploymentLocksPlatform } from '../deploymentLock';

// src/services/onlineMusic/emby/embySession.ts
// The signed-in Emby server. A deployment lock is read from the build and is not written to disk.

const STORAGE_KEY = 'emby_session';

let lockedUserId = '';

export const rememberLockedEmbyUser = (userId: string): void => {
    lockedUserId = userId;
};

export interface EmbySession {
    serverUrl: string;
    userId: string;
    username: string;
    accessToken: string;
    /** True when requests use the shared, server-side deployment account. */
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
        return {
            serverUrl: '',
            userId: lockedUserId,
            username: 'Emby',
            accessToken: '',
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
