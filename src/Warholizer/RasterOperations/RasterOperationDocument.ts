import { Filter } from "./Filter";

export type RasterOperationDocument = {
  id: string;
  rootId: string;
  filterById: { [id: string]: Filter; };
};
