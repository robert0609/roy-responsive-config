import { reactive, watch, WatchStopHandle } from 'vue';
import traverse from 'traverse';
import { getFieldMetadata } from './decorator';

const rootKey = '$root';

export class Responsive<T extends object = object> {
  private _reactiveData = reactive<{
    [rootKey]?: unknown;
  }>({ [rootKey]: undefined });

  get value() {
    return this._reactiveData;
  }

  private _unwatches: WatchStopHandle[] = [];

  constructor(originalData: T) {
    // watch(this._reactiveData, (newVal, oldVal) => {}, {
    //   deep: true
    // })

    this._reactiveData[rootKey] = originalData;

    const that = this // eslint-disable-line
    const traverseData = traverse(this._reactiveData);
    traverseData.forEach(function (val) {
      if (!this.parent) {
        return;
      }
      const p = this.key!;
      const fieldMetadata = getFieldMetadata(this.parent.node, p);
      if (fieldMetadata !== undefined && fieldMetadata.watch !== undefined) {
        // const watchTarget = traverseData.get([...this.path.slice(0, this.path.length - 1), ...fieldMetadata.watch.fieldName.split('.')])
        const unwatch = watch(
          () =>
            traverseData.get([
              ...this.path.slice(0, this.path.length - 1),
              ...fieldMetadata!.watch!.fieldName.split('.')
            ]),
          (newVal, oldVal) => {
            fieldMetadata.watch!.handler.call(
              this.parent!.node,
              newVal,
              oldVal
            );
          }
        );
        that._unwatches.push(unwatch);
      }
    });
  }

  dispose() {
    this._unwatches.forEach((unwatch) => unwatch());
  }
}
