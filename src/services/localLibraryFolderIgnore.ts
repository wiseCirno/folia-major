// src/services/localLibraryFolderIgnore.ts
// The local library is gone. Folder ignore flags are no longer stored.

export const normalizeLocalFolderPath = (path: string) => path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');

export function runLocalFolderMutation<T>(operation: () => Promise<T>): Promise<T> {
    return operation();
}

export const isLocalFolderIgnored = (path: string, ignoredPaths: readonly string[]) => (
    ignoredPaths.some(ignored => path === ignored || path.startsWith(`${ignored}/`))
);

export async function setLocalFolderIgnored(_folderPath: string, _ignored: boolean): Promise<void> {}
