import { PureRasterOperation } from "./types";
import { defaultOperationsByKind, operationRegistry } from "./registry";

/** <option>s for every operation, grouped by kind, labeled from the registry. Values are operation types. */
export const OperationTypeOptions = ({ operations }: { operations?: PureRasterOperation[] }) => (
  <>
    {defaultOperationsByKind.map(group => {
      const ops = group.operations.filter(op => !operations || operations.some(o => o.type === op.type));
      return ops.length === 0 ? null : (
        <optgroup key={group.kind} label={group.label}>
          {ops.map(op => (
            <option key={op.type} value={op.type} title={operationRegistry[op.type].description}>
              {operationRegistry[op.type].label}
            </option>
          ))}
        </optgroup>
      );
    })}
  </>
);
