import { PureRasterOperation } from "./PureRasterOperation";

export type Filter = {
  id: string;
  operation: PureRasterOperation;
  inputFilterIds: string[];
};
