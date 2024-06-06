import React from "react";
import { ImageRecord, imageAsRecord } from "./ImageRecord";
import { SampleImageLibrary, loadSampleImages, sampleImageUrls, SampleImageUrl } from "./sampleImageUrls";

export function useSampleImages(
  urlGetter: (library: SampleImageLibrary) => SampleImageUrl[],
  handleImages: (imgs: ImageRecord[]) => void
) {
  React.useEffect(() => {
    const urls = urlGetter(sampleImageUrls);
    loadSampleImages(urls)
      .then(imgs => imgs.map(imageAsRecord))
      .then(handleImages);
  }, [handleImages, urlGetter]);
}
