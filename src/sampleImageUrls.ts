import ImageUtil from "./Warholizer/ImageUtil";

export type SampleImageUrl = "/warhol.jpg" | "/banana.jpg" | "/soup-can.jpg";

export type SampleImageLibrary = {
    warhol: SampleImageUrl,
    banana: SampleImageUrl,
    soupCan: SampleImageUrl
};

export const sampleImageUrls: SampleImageLibrary = {
    warhol : "/warhol.jpg"   as SampleImageUrl,
    banana : "/banana.jpg"   as SampleImageUrl,
    soupCan: "/soup-can.jpg" as SampleImageUrl
};

export const loadSampleImages = (urls: SampleImageUrl[]) => 
    Promise.all(urls.map(ImageUtil.loadOffscreen));