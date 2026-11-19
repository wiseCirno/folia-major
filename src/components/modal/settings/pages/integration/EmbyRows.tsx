import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Reveal, Row, Status, TextField, Toggle } from '@/components/modal/settings/kit/index.ts';
import { authenticateEmby } from '@/services/onlineMusic/emby/embyApi.ts';
import { clearEmbySession, getEmbySession, saveEmbySession } from '@/services/onlineMusic/emby/embySession.ts';
import { O } from './options';

// src/components/modal/settings/pages/integration/EmbyRows.tsx
// The Emby rows of the 连接与集成 page; the parent hides them in locked deployments.

export const EmbyRows: React.FC = () => {
    const { t } = useTranslation();
    const saved = getEmbySession();
    const [url, setUrl] = useState(saved?.serverUrl ?? '');
    const [username, setUsername] = useState(saved?.username ?? '');
    const [password, setPassword] = useState('');
    const [connected, setConnected] = useState(Boolean(saved?.accessToken));
    const [enabled, setEnabled] = useState(() => localStorage.getItem('emby_enabled') !== 'false');
    const [status, setStatus] = useState<'idle' | 'testing' | 'ok' | 'failed'>('idle');
    const toggle = (next: boolean) => {
        localStorage.setItem('emby_enabled', next ? 'true' : 'false');
        setEnabled(next);
    };

    const test = async () => {
        setStatus('testing');
        try {
            const session = await authenticateEmby(url.trim().replace(/\/+$/, ''), username.trim(), password);
            saveEmbySession(session);
            setConnected(true);
            setStatus('ok');
        } catch (error) {
            console.warn('[Emby] connection test failed', error);
            setStatus('failed');
        }
    };

    return (
        <>
            <Row option={O.emby}>
                <Toggle checked={enabled} onChange={toggle} />
            </Row>
            <Reveal when={enabled}>
                <Row sub option={O.embyUrl}>
                    <TextField type="url" value={url} onChange={setUrl} placeholder={t('emby.serverUrlPlaceholder')} />
                </Row>
                <Row sub option={O.embyUsername}>
                    <TextField value={username} onChange={setUsername} />
                </Row>
                <Row sub option={O.embyPassword}>
                    <TextField type="password" value={password} onChange={setPassword} placeholder={connected ? '••••••••' : undefined} />
                </Row>
                <Row
                    sub
                    label={status === 'failed'
                        ? <Status tone="error">{t('emby.connectionFailed')}</Status>
                        : status === 'ok' || connected
                            ? <Status tone="ok">{t('emby.connectionSuccess')}</Status>
                            : <Status>{t('emby.notConfigured')}</Status>}
                >
                    {connected && (
                        <Button onClick={() => { clearEmbySession(); setConnected(false); setPassword(''); setStatus('idle'); }}>
                            {t('emby.clearSettings')}
                        </Button>
                    )}
                    <Button variant="primary" onClick={() => void test()} disabled={status === 'testing' || !url || !username || !password}>
                        {status === 'testing' ? t('emby.testing') : t('emby.testConnection')}
                    </Button>
                </Row>
            </Reveal>
        </>
    );
};

export default EmbyRows;
