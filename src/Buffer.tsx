export class Buffer<T> {
  items: T[];
  maxSize: number;
  constructor(maxSize: number, items?: T[]) {
    this.maxSize = maxSize;
    this.items = (items ?? []).slice(0, maxSize);
  }
  push(item: T) {
    const nextItems = [...this.items];
    if (nextItems.length === this.maxSize) {
      nextItems.shift();
    }
    nextItems.push(item);
    return new Buffer<T>(this.maxSize, nextItems);
  }
}
