import type {
    LocalLibraryArtistAssignmentMode,
    LocalLibraryEntity,
    LocalLibrarySplitTarget,
} from '../types/localLibrary';

// src/services/localLibraryEntityMutations.ts
// The local library is gone. Entity edits no longer write anywhere.

const emptyEntity = (id: string): LocalLibraryEntity => ({
    id,
    kind: 'artist',
    displayName: '',
    aliases: [],
    normalizedAliases: [],
    createdAt: 0,
    updatedAt: 0,
});

export const mergeEntities = async (_targetEntityId: string, _sourceEntityIds: string[]): Promise<void> => {};

export const splitEntity = async (
    entityId: string,
    _songIds: string[],
    _displayName: string,
): Promise<LocalLibraryEntity> => emptyEntity(entityId);

export const moveEntityMembersToExistingEntity = async (
    _sourceEntityId: string,
    targetEntityId: string,
    _songIds: string[],
): Promise<LocalLibraryEntity> => emptyEntity(targetEntityId);

export const splitArtistEntityToTargets = async (
    _sourceEntityId: string,
    _songIds: string[],
    _destinations: LocalLibrarySplitTarget[],
    _mode: LocalLibraryArtistAssignmentMode,
): Promise<LocalLibraryEntity[]> => [];

export const setEntityDisplayName = async (_entityId: string, _displayName: string): Promise<void> => {};
