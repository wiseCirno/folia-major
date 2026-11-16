// src/services/onlineMusic/deploymentLock.ts
// A build can pin one online server. The platform id, its URL, and its API key all have to be set.

export interface DeploymentLock {
    platformId: string;
    serverUrl: string;
    apiKey: string;
    username: string;
    password: string;
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** Reads one env bag. A lock needs a platform id, an http(s) server, and an API key. */
export const parseDeploymentLock = (env: Record<string, unknown>): DeploymentLock | null => {
    const platformId = text(env.VITE_FOLIA_ONLINE_PLATFORM).toLowerCase();
    const serverUrl = text(env.VITE_FOLIA_ONLINE_SERVER_URL).replace(/\/+$/, '');
    const apiKey = text(env.VITE_FOLIA_ONLINE_API_KEY);
    if (!platformId || !serverUrl || !apiKey) return null;
    if (!/^https?:\/\//i.test(serverUrl)) return null;
    return {
        platformId,
        serverUrl,
        apiKey,
        username: text(env.VITE_FOLIA_ONLINE_USERNAME),
        password: text(env.VITE_FOLIA_ONLINE_PASSWORD),
    };
};

/** The pinned server, or null when this build still lets someone choose a platform. */
export const readDeploymentLock = (): DeploymentLock | null => parseDeploymentLock(import.meta.env);

export const isDeploymentLocked = (): boolean => readDeploymentLock() !== null;

export const deploymentLocksPlatform = (platformId: string): boolean => {
    const lock = readDeploymentLock();
    return lock !== null && lock.platformId === platformId;
};
