export type ImageRecord = { id: string; osc: OffscreenCanvas; };
export const imageAsRecord = (osc: OffscreenCanvas): ImageRecord => ({
    id: crypto.randomUUID(),
    osc
});