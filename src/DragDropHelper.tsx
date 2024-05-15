export const DragDropHelper = {
    move: function <T>(fromArray: T[], fromIndex: number, toArray: T[], toIndex: number): [T[], T[]] {
        const fromArrayUpdated = [...fromArray];
        const [removed] = fromArrayUpdated.splice(fromIndex, 1);
        const toArrayUpdated = [...toArray];
        toArrayUpdated.splice(toIndex, 0, removed);
        return [fromArrayUpdated, toArrayUpdated];
    },
    reorder: function <T>(array: T[], fromIndex: number, toIndex: number): T[] {
        const result = [...array];
        const [removed] = result.splice(fromIndex, 1);
        result.splice(toIndex, 0, removed);
        return result;
    }
};
