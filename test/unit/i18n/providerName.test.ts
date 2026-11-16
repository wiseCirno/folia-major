import { describe, expect, it } from 'vitest';
import en from '@/i18n/locales/en';
import zhCN from '@/i18n/locales/zh-CN';
import { listOnlineMusicProviders } from '@/services/onlineMusic/providerRegistry';

// test/unit/i18n/providerName.test.ts
// A provider names itself in the interface through `shortNameKey` (`onlineProviderName.<id>`), and the
// interface translates it. These pin that every registered provider has that key in every language
// (otherwise the English interface would fall back to the platform's own, usually Chinese, name),
// and that the Mandarin names live in the Mandarin bundle.

type Bundle = { onlineProviderName?: Record<string, string> };
const names = (bundle: unknown): Record<string, string> => (bundle as Bundle).onlineProviderName ?? {};

describe('provider names in the locale bundles', () => {
    it('has a short name for every registered provider, in every language', () => {
        const ids = listOnlineMusicProviders().map(provider => provider.id).sort();
        expect(ids.length).toBeGreaterThan(0);
        for (const bundle of [en, zhCN]) {
            expect(Object.keys(names(bundle)).sort()).toEqual(ids);
        }
    });

    it('keeps the Mandarin names in the Mandarin bundle', () => {
        expect(names(zhCN)).toMatchObject({
            navidrome: 'Navidrome',
            emby: 'Emby',
        });
    });
});
