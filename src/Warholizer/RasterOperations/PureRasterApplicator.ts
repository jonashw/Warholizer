import { PureRasterOperation } from "./PureRasterOperation"

export type PureRasterApplicator = {
    type: "flatMap" | "zip",
    ops: PureRasterOperation[]
}