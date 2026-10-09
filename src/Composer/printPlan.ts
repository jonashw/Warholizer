import { inferComposition } from "./infer";
import { Composition, Format, MemberKey } from "./types";

/** Below this, prints look soft. */
export const minimumPrintDpi = 150;

export type PhotoPrint = {
  /** The largest placement of the photo on any page, in page pixels per photo pixel. */
  photoScale: number,
  /** The photo's resolution where it is printed largest. */
  effectiveDpi: number,
  format: Format,
};

/**
 * Plans printing without rendering (ADR 0003, Lengths: plan before render): at full size, how
 * large each photo is placed on pages. Exports load each photo at just that resolution, and photos
 * that would print soft are flagged.
 */
export const planPrint = async (composition: Composition, photoSizes: [number, number][]): Promise<Map<MemberKey, PhotoPrint>> => {
  const plan = new Map<MemberKey, PhotoPrint>();
  await inferComposition(composition, photoSizes, undefined, ({ photo, photoScale, format }) => {
    if (photo === undefined || !Number.isFinite(photoScale) || photoScale <= 0) return;
    const current = plan.get(photo);
    if (!current || photoScale > current.photoScale) {
      plan.set(photo, { photoScale, effectiveDpi: Math.round(format.dpi / photoScale), format });
    }
  });
  return plan;
};

/** How much to shrink each photo before a full-size export: no more than its largest placement needs (with a little headroom). */
export const exportScaleOf = (print: PhotoPrint | undefined) =>
  print ? Math.min(1, print.photoScale * 1.1) : 1;
