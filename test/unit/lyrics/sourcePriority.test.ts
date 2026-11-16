import { describe, expect, it } from 'vitest';
import {
    buildLyricSourceOrder,
    migratePreferredLyricSource,
} from '@/utils/lyrics/sourcePriority';

// test/unit/lyrics/sourcePriority.test.ts

describe('lyric source priority', () => {
    it('offers only AMLL', () => {
        expect(buildLyricSourceOrder()).toEqual(['amll']);
        expect(buildLyricSourceOrder('amll')).toEqual(['amll']);
    });

    it('falls back to AMLL when a stored preference is no longer a source', () => {
        expect(migratePreferredLyricSource(null, null)).toBe('amll');
        expect(migratePreferredLyricSource(null, 'netease')).toBe('amll');
        expect(migratePreferredLyricSource(null, 'qq')).toBe('amll');
        expect(migratePreferredLyricSource(null, 'invalid')).toBe('amll');
        expect(migratePreferredLyricSource('netease', 'qq')).toBe('amll');
        expect(migratePreferredLyricSource(null, 'amll')).toBe('amll');
        expect(migratePreferredLyricSource('amll', 'qq')).toBe('amll');
    });
});
