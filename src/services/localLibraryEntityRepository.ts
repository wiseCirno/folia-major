import type { LocalLibraryAssignment, LocalLibraryEntity, LocalLibraryEntityKind } from '../types/localLibrary';

// src/services/localLibraryEntityRepository.ts
// The local library is gone. Catalog reads stay empty.

type LocalLibraryCatalogSnapshot = {
    entities: LocalLibraryEntity[];
    assignments: LocalLibraryAssignment[];
};

const emptySnapshot = (): LocalLibraryCatalogSnapshot => ({ entities: [], assignments: [] });

export const getLocalLibraryEntities = async (_kind?: LocalLibraryEntityKind): Promise<LocalLibraryEntity[]> => [];

export const getLocalLibraryAssignments = async (): Promise<LocalLibraryAssignment[]> => [];

export const getLocalLibraryAssignment = async (_songId: string): Promise<LocalLibraryAssignment | undefined> => undefined;

export const invalidateLocalLibraryCatalogSnapshot = (): void => {};

export const getLocalLibraryCatalogSnapshot = async (): Promise<LocalLibraryCatalogSnapshot> => emptySnapshot();

export const resolveEntityRedirect = async (_entityId: string): Promise<LocalLibraryEntity | undefined> => undefined;
