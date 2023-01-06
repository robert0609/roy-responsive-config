import { FormItemType, IFormItem, IFormItemGroup } from './type';

const fieldMetadataKey = Symbol('fieldMetadataKey');

type WatchHandlerType<T = any> = (
  newVal: T,
  oldVal: T,
  patch: (nodeData: unknown) => void
) => void;

interface IFieldMetadata {
  groupConfig?: Omit<IFormItemGroup, 'key'>;
  editConfig?: Omit<IFormItem<FormItemType>, 'key'>;
  watch?: {
    fieldNames: string[];
    handler: WatchHandlerType;
  };
}

/**
 * Property Decorator
 * @param config form item group's meta config
 */
export function fieldGroup(config: Omit<IFormItemGroup, 'key'>) {
  return function (target: any, p: string) {
    const originalMetadata = getFieldMetadata(target, p) || {};
    Reflect.defineMetadata(fieldMetadataKey, Object.assign(originalMetadata, {
      groupConfig: config
    }), target, p);
  }
}

/**
 * Property Decorator
 * @param formItemConfig form item's meta config that is used to render config UI
 */
export function fieldEdit<F extends FormItemType = FormItemType>(
  formItemConfig: Omit<IFormItem<F>, 'key'>
) {
  return function (target: any, p: string) {
    const originalMetadata = getFieldMetadata(target, p) || {};
    Reflect.defineMetadata(fieldMetadataKey, Object.assign(originalMetadata, {
      editConfig: formItemConfig
    }), target, p);
  }
}

/**
 * Property Decorator
 * @param fieldNames watched fieldNames
 * @param handler when watched fields were changed, this handler will be run
 */
export function fieldWatch<T>(
  fieldNames: string[],
  handler: WatchHandlerType<T>
) {
  return function (target: any, p: string) {
    const originalMetadata = getFieldMetadata(target, p) || {};
    Reflect.defineMetadata(fieldMetadataKey, Object.assign(originalMetadata, {
      watch: {
        fieldNames,
        handler
      }
    }), target, p);
  }
}

export function getFieldMetadata(
  target: any,
  propertyKey: string
): IFieldMetadata {
  return Reflect.getMetadata(fieldMetadataKey, target, propertyKey);
}
