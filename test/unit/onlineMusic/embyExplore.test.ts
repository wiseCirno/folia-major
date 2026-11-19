import { afterEach, describe, expect, it, vi } from 'vitest';
import { embyProvider } from '@/services/onlineMusic/emby/embyProvider';

// Exercise the Emby adapter when the server does not offer personalized suggestions.
vi.mock('@/services/onlineMusic/emby/embySession', () => ({
    getEmbySession: () => ({ locked: true, userId: 'deployment', username: 'Emby', serverUrl: '', accessToken: '' }),
}));

afterEach(() => vi.unstubAllGlobals());

describe('Emby explore', () => {
    it('keeps latest songs and albums when suggestions fail, and falls back for daily songs', async () => {
        const fetchMusic = vi.fn((url: string) => {
            const path = new URL(url, 'https://folia.invalid').searchParams.get('path') ?? '';
            const { pathname, searchParams } = new URL(path, 'https://emby.invalid');
            if (pathname.endsWith('/Suggestions')) return Promise.resolve(new Response(null, { status: 404 }));
            if (pathname.endsWith('/Views')) {
                return Promise.resolve(Response.json({ Items: [{ Id: 'music', Name: 'Music', CollectionType: 'music' }] }));
            }
            expect(pathname).toBe('/Users/deployment/Items');
            expect(searchParams.get('ParentId')).toBe('music');
            expect(searchParams.get('SortBy')).toBe('DateCreated');
            expect(searchParams.get('SortOrder')).toBe('Descending');
            const type = searchParams.get('IncludeItemTypes');
            return Promise.resolve(Response.json({ Items: [{ Id: type, Name: type, Type: type }] }));
        });
        vi.stubGlobal('fetch', fetchMusic);
        const feed = await embyProvider.explore?.getFeed();
        expect(feed?.sections.map(section => section.id)).toEqual(['latest-songs', 'latest-albums']);
        const daily = await embyProvider.recommendations?.getDailySongs?.();
        expect(daily).toMatchObject([{ id: 'Audio' }]);
    });
});
