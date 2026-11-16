// src/services/onlineMusic/emby/embyLyrics.ts
// Picks the text subtitle stream Emby stores on an audio item. Audio still streams from /Audio.

export interface EmbyMediaStream {
    Index?: number;
    Type?: string;
    IsTextSubtitleStream?: boolean;
}

export interface EmbySubtitleTarget {
    mediaSourceId: string;
    index: number;
}

interface EmbyMediaSource {
    Id?: string;
    MediaStreams?: EmbyMediaStream[];
}

/** The first text subtitle on the first media source that has one. */
export const textSubtitleTarget = (sources: readonly EmbyMediaSource[] | undefined): EmbySubtitleTarget | null => {
    for (const source of sources ?? []) {
        if (!source.Id) continue;
        const stream = source.MediaStreams?.find(item => (
            item.Type === 'Subtitle' && item.IsTextSubtitleStream === true && typeof item.Index === 'number'
        ));
        if (stream?.Index !== undefined) return { mediaSourceId: source.Id, index: stream.Index };
    }
    return null;
};

export const embySubtitleLrcPath = (itemId: string, target: EmbySubtitleTarget): string => (
    `/Videos/${encodeURIComponent(itemId)}/${encodeURIComponent(target.mediaSourceId)}/Subtitles/${target.index}/Stream.lrc`
);
