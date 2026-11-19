// Only the provider ID is public. The deployment account lives in the same-origin function.
export const readDeploymentLock = (): { platformId: string } | null => (
    typeof __FOLIA_ONLINE_PLATFORM__ !== 'undefined' && __FOLIA_ONLINE_PLATFORM__
        ? { platformId: __FOLIA_ONLINE_PLATFORM__ }
        : null
);

export const isDeploymentLocked = (): boolean => readDeploymentLock() !== null;

export const deploymentLocksPlatform = (platformId: string): boolean => readDeploymentLock()?.platformId === platformId;

export const deploymentMusicUrl = (provider: string, path: string): string => (
    `/api/music?${new URLSearchParams({ provider, path })}`
);
