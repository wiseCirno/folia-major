// src/services/localLibraryAvailability.ts
// The web player no longer offers a local library.

export interface LocalLibraryAvailability {
    supported: boolean;
    reason: 'insecure-http' | 'file-system-api-unavailable' | null;
}

export const getLocalLibraryAvailability = (): LocalLibraryAvailability => ({
    supported: false,
    reason: 'file-system-api-unavailable',
});
