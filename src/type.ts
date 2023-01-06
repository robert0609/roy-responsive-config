export type FormItemType = keyof IFormItemProperties;
export type FormItemProperties<F extends FormItemType> = IFormItemProperties[F];

export interface IFormItemProperties {
  text: {
    defaultValue: string;
    placeholder: string;
  };
  select: {
    defaultValue: string;
    placeholder: string;
    options: {
      value: string;
      name: string;
    }[];
  };
  radio: {
    defaultValue: string;
    options: {
      value: string;
      name: string;
    }[];
  };
  checkbox: {
    defaultValue: string[];
    options: {
      value: string;
      name: string;
    }[];
  };
  switch: {
    defaultValue: boolean;
  };
}

export interface IBaseFormItem {
  key: string; // 内部表单项对应的数据字段名
  name: string; // 页面上展示的表单名称
}

export interface IFormItem<T extends FormItemType> extends IBaseFormItem {
  type: T; // 表单项类型，不同类型对应不同的交互方式
  required: boolean;
  readonly: boolean;
  properties: IFormItemProperties[T];
}

export interface IFormItemGroup extends IBaseFormItem {
  children?: IFormItemGroup[];
  newFormItem?: () => void;
  deleteFormItem?: (key: number | string) => void;
}

export function isBaseFormItem(o: any): o is IBaseFormItem {
  return o.key !== undefined && o.name !== undefined;
}

export function isFormItem<T extends FormItemType = FormItemType>(
  o: any
): o is IFormItem<T> {
  return !isFormItemGroup(o) && isBaseFormItem(o);
}

export function isFormItemGroup(o: any): o is IFormItemGroup {
  return o.type === undefined && isBaseFormItem(o);
}
