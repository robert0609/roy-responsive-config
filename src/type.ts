export type FormItemType = 'text' | 'select' | 'radio' | 'checkbox' | 'switch';
export type FormItemValueType = boolean | string | string[];

export interface IFormItemProperties {
  defaultValue: FormItemValueType;
  placeholder?: string;
  options?: {
    value: string;
    name: string;
  }[];
}

export interface IBaseFormItem {
  key: string; // 内部表单项对应的数据字段名
  name: string; // 页面上展示的表单名称
  condition?: { field: string; value: FormItemValueType }[]; // 表单项展示的条件
}

export interface IFormItem extends IBaseFormItem {
  type: FormItemType; // 表单项类型，不同类型对应不同的交互方式
  required: boolean;
  readonly: boolean;
  properties: IFormItemProperties;
}

export interface IFormItemGroup extends IBaseFormItem {
  children?: IFormItemGroup[];
  newFormItem?: () => void;
  deleteFormItem?: (key: number | string) => void;
}

export function isBaseFormItem(o: any): o is IBaseFormItem {
  return o.key !== undefined && o.name !== undefined;
}

export function isFormItem(o: any): o is IFormItem {
  return !isFormItemGroup(o) && isBaseFormItem(o);
}

export function isFormItemGroup(o: any): o is IFormItemGroup {
  return o.type === undefined && isBaseFormItem(o);
}
