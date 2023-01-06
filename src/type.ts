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

export interface IFormItem<T extends FormItemType> extends IFormItemGroup {
  key: string; // 内部表单项对应的数据字段名
  name: string; // 页面上展示的表单名称
  type: T; // 表单项类型，不同类型对应不同的交互方式
  required: boolean;
  readonly: boolean;
  properties: IFormItemProperties[T];
}

export interface IFormItemGroup {
  key: string;
  name: string;
  children?: IFormItemGroup[];
  newFormItem?: () => void;
}
