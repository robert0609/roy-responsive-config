import {
  FormItemType,
  IFormItem,
  IFormItemGroup,
  IFormItemProperties,
  FormItemValueType
} from './type';
import { fieldEdit, fieldGroup, fieldWatch, syncConfig } from './decorator';

export class FormOption {
  @fieldEdit({
    name: '选项值',
    type: 'text',
    required: true,
    readonly: false,
    properties: {
      defaultValue: '',
      placeholder: '请输入选项值'
    }
  })
  readonly value: string;

  @fieldEdit({
    name: '选项名称',
    type: 'text',
    required: true,
    readonly: false,
    properties: {
      defaultValue: '',
      placeholder: '请输入选项名称'
    }
  })
  readonly name: string;

  constructor(value = '', name = '') {
    this.value = value;
    this.name = name;
  }
}

export class FormCondition {
  readonly field: string;
  readonly value: FormItemValueType;
  constructor(field: string = '', value: FormItemValueType = '') {
    this.field = field;
    this.value = value;
  }
}

export class FormItemProperties implements IFormItemProperties {
  defaultValue: FormItemValueType;
  placeholder?: string;
  options?: FormOption[];

  constructor(
    defaultValue: FormItemValueType = '',
    placeholder?: string,
    options?: FormOption[]
  ) {
    this.defaultValue = defaultValue;
    this.placeholder = placeholder;
    this.options = options;
  }
}

export class FormItem implements IFormItem {
  @fieldEdit({
    name: '字段名',
    type: 'text',
    required: true,
    readonly: false,
    properties: {
      defaultValue: '',
      placeholder: '请输入字段名'
    }
  })
  readonly key: string;

  @fieldEdit({
    name: '表单项名称',
    type: 'text',
    required: true,
    readonly: false,
    properties: {
      defaultValue: '',
      placeholder: '请输入表单项名称'
    }
  })
  readonly name: string;

  @fieldEdit({
    name: '表单项类型',
    type: 'select',
    required: true,
    readonly: false,
    properties: {
      defaultValue: '',
      placeholder: '请选择表单项类型',
      options: [
        { value: 'text', name: '输入框' },
        { value: 'select', name: '下拉框' },
        { value: 'radio', name: '单选框' },
        { value: 'checkbox', name: '多选框' },
        { value: 'switch', name: '开关' }
      ]
    }
  })
  readonly type: FormItemType;

  @fieldEdit({
    name: '是否必填',
    type: 'switch',
    required: true,
    readonly: false,
    properties: {
      defaultValue: false
    }
  })
  readonly required: boolean;

  @fieldEdit({
    name: '是否只读',
    type: 'switch',
    required: true,
    readonly: false,
    properties: {
      defaultValue: false
    }
  })
  readonly readonly: boolean;

  @fieldGroup({
    name: '其它属性'
  })
  readonly properties: FormItemProperties;

  @fieldGroup({
    name: '显示条件'
  })
  readonly condition?: FormCondition[];

  constructor(
    key = '',
    name = '',
    type: FormItemType = 'text',
    required = false,
    readonly = false,
    properties = new FormItemProperties(),
    condition?: FormCondition[]
  ) {
    this.key = key;
    this.name = name;
    this.type = type;
    this.required = required;
    this.readonly = readonly;
    this.properties = properties;
    this.condition = condition;
  }
}

export class FormItemGroup implements IFormItemGroup {
  readonly key: string;

  readonly name: string;

  readonly condition?: FormCondition[];

  children?: IFormItemGroup[];
  newFormItem?: () => void;
  deleteFormItem?: (key: number | string) => void;

  constructor(key = '', name = '', condition?: FormCondition[]) {
    this.key = key;
    this.name = name;
    this.condition = condition;
  }
}
