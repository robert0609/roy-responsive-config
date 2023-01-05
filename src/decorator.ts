import { FormItemType, IFormItem, IFormItemGroup } from './type';

const fieldMetadataKey = Symbol('fieldMetadataKey');

type WatchHandlerType<T = any, ThisType extends object = object> = (
  this: ThisType,
  newVal: T,
  oldVal: T
) => void;

interface IFieldMetadata {
  groupConfig?: Omit<IFormItemGroup, 'key'>;
  editConfig?: Omit<IFormItem<FormItemType>, 'key'>;
  watch?: {
    fieldName: string;
    handler: WatchHandlerType;
  };
}

export function fieldGroup(config: Omit<IFormItemGroup, 'key'>) {
  return Reflect.metadata(fieldMetadataKey, {
    groupConfig: config
  } as IFieldMetadata);
}

export function fieldEdit<F extends FormItemType = FormItemType>(
  formItemConfig: Omit<IFormItem<F>, 'key'>
) {
  return Reflect.metadata(fieldMetadataKey, {
    editConfig: formItemConfig
  } as IFieldMetadata);
}

export function fieldWatch<T, ThisType extends object>(
  fieldName: string,
  handler: WatchHandlerType<T, ThisType>
) {
  return function (target: ThisType, p: string) {
    Reflect.defineMetadata(
      fieldMetadataKey,
      {
        watch: {
          fieldName,
          handler
        }
      } as IFieldMetadata,
      target,
      p
    );
  };

  // return Reflect.metadata(fieldMetadataKey, {
  //   watch: {
  //     fieldName,
  //     handler
  //   }
  // } as IFieldMetadata);
}

export function getFieldMetadata(
  target: any,
  propertyKey: string
): IFieldMetadata {
  return Reflect.getMetadata(fieldMetadataKey, target, propertyKey);
}
