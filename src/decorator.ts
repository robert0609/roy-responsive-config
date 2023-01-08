import { IFormItem, IFormItemGroup } from './type';

const fieldMetadataKey = Symbol('fieldMetadataKey');

type WatchHandlerType<T = any> = (
  newVal: T,
  oldVal: T,
  update: (nodeData: unknown) => void
) => void;

type FieldGroupParameterType = Omit<
  IFormItemGroup,
  'key' | 'newFormItem' | 'deleteFormItem'
> & {
  createNewFormItem?: () => any;
};

type FieldEditParameterType = Omit<IFormItem, 'key'>;

export interface IFieldMetadata {
  groupConfig?: FieldGroupParameterType;
  editConfig?: FieldEditParameterType;
  watch?: {
    fieldNames: string[];
    handler: WatchHandlerType;
  };
  autoSyncConfig?: boolean;
}

/**
 * Property Decorator
 * @param config form item group's meta config
 */
export function fieldGroup(config: FieldGroupParameterType) {
  return function (target: any, p: string) {
    const originalMetadata = getFieldMetadata(target, p) || {};
    Reflect.defineMetadata(
      fieldMetadataKey,
      Object.assign(originalMetadata, {
        groupConfig: config
      }),
      target,
      p
    );
  };
}

/**
 * Property Decorator
 * @param formItemConfig form item's meta config that is used to render config UI
 */
export function fieldEdit(formItemConfig: FieldEditParameterType) {
  return function (target: any, p: string) {
    const originalMetadata = getFieldMetadata(target, p) || {};
    Reflect.defineMetadata(
      fieldMetadataKey,
      Object.assign(originalMetadata, {
        editConfig: formItemConfig
      }),
      target,
      p
    );
  };
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
    Reflect.defineMetadata(
      fieldMetadataKey,
      Object.assign(originalMetadata, {
        watch: {
          fieldNames,
          handler
        }
      }),
      target,
      p
    );
  };
}

/**
 * Property Decorator
 */
export function syncConfig(target: any, p: string) {
  const originalMetadata = getFieldMetadata(target, p) || {};
  Reflect.defineMetadata(
    fieldMetadataKey,
    Object.assign(originalMetadata, {
      autoSyncConfig: true
    }),
    target,
    p
  );
}

export function getFieldMetadata(
  target: any,
  propertyKey: string
): IFieldMetadata {
  return Reflect.getMetadata(fieldMetadataKey, target, propertyKey);
}
