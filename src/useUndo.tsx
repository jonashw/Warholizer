import React from 'react';
import { UndoState } from './UndoState';

export function useUndo<T>(initialState: T) {
    const initialUndoState = {
        prev: [],
        curr: initialState,
        next: [],
    };
    const [state, setState] = React.useState<UndoState<T>>(initialUndoState);
    return {
        currentState: state.curr,
        canUndo() {
            return state.prev.length > 0;
        },
        canRedo() {
            return state.next.length > 0;
        },
        undo() {
            const newPrev = [...state.prev];
            const newCurr = newPrev.pop();
            if (!newCurr) {
                return;
            }
            setState({
                prev: newPrev,
                curr: newCurr,
                next: !state.curr
                    ? state.next
                    : [...state.next, state.curr],
            });
        },
        redo() {
            const newNext = [...state.next];
            const newCurr = newNext.pop();
            if (!newCurr) {
                return;
            }
            setState({
                prev: !state.curr
                    ? state.prev
                    : [...state.prev, state.curr],
                curr: newCurr,
                next: newNext
            });
        },
        onChange(newCurrentState: T): void {
            setState({
                prev: !state.curr
                    ? state.prev
                    : [...state.prev, state.curr],
                curr: newCurrentState,
                next: []
            });
        }
    };
}
