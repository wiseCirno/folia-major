// src/services/onlineMusic/deploymentLock.ts
// A build can pin one online server. The platform id and URL are required, plus either an API key or a username and password.

export interface DeploymentLock {
    platformId: string;
    serverUrl: string;
    apiKey: string;
    username: string;
    password: string;
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const first = (env: Record<string, unknown>, ...names: string[]): string => {
    for (const name of names) {
        const value = text(env[name]);
        if (value) return value;
    }
    return '';
};

/** Reads one env bag. `FOLIA_ONLINE_*` is the name used on Vercel; `VITE_FOLIA_ONLINE_*` still works locally. */
export const parseDeploymentLock = (env: Record<string, unknown>): DeploymentLock | null => {
    const platformId = first(env, 'FOLIA_ONLINE_PLATFORM', 'VITE_FOLIA_ONLINE_PLATFORM').toLowerCase();
    const serverUrl = first(env, 'FOLIA_ONLINE_SERVER_URL', 'VITE_FOLIA_ONLINE_SERVER_URL').replace(/\/+$/, '');
    const apiKey = first(env, 'FOLIA_ONLINE_API_KEY', 'VITE_FOLIA_ONLINE_API_KEY');
    const username = first(env, 'FOLIA_ONLINE_USERNAME', 'VITE_FOLIA_ONLINE_USERNAME');
    const password = first(env, 'FOLIA_ONLINE_PASSWORD', 'VITE_FOLIA_ONLINE_PASSWORD');
    if (!platformId || !serverUrl) return null;
    if (!apiKey && !(username && password)) return null;
    if (!/^https?:\/\//i.test(serverUrl)) return null;
    return {
        platformId,
        serverUrl,
        apiKey,
        username,
        password,
    };
};

/** The pinned server, or null when this build still lets someone choose a platform. */
// Each key is read by name. Vite only inlines `import.meta.env.NAME`, not a lookup on the whole env object.
export const readDeploymentLock = (): DeploymentLock | null => parseDeploymentLock({
    FOLIA_ONLINE_PLATFORM: import.meta.env.FOLIA_ONLINE_PLATFORM,
    FOLIA_ONLINE_SERVER_URL: import.meta.env.FOLIA_ONLINE_SERVER_URL,
    FOLIA_ONLINE_API_KEY: import.meta.env.FOLIA_ONLINE_API_KEY,
    FOLIA_ONLINE_USERNAME: import.meta.env.FOLIA_ONLINE_USERNAME,
    FOLIA_ONLINE_PASSWORD: import.meta.env.FOLIA_ONLINE_PASSWORD,
    VITE_FOLIA_ONLINE_PLATFORM: import.meta.env.VITE_FOLIA_ONLINE_PLATFORM,
    VITE_FOLIA_ONLINE_SERVER_URL: import.meta.env.VITE_FOLIA_ONLINE_SERVER_URL,
    VITE_FOLIA_ONLINE_API_KEY: import.meta.env.VITE_FOLIA_ONLINE_API_KEY,
    VITE_FOLIA_ONLINE_USERNAME: import.meta.env.VITE_FOLIA_ONLINE_USERNAME,
    VITE_FOLIA_ONLINE_PASSWORD: import.meta.env.VITE_FOLIA_ONLINE_PASSWORD,
});

export const isDeploymentLocked = (): boolean => readDeploymentLock() !== null;

export const deploymentLocksPlatform = (platformId: string): boolean => {
    const lock = readDeploymentLock();
    return lock !== null && lock.platformId === platformId;
};
