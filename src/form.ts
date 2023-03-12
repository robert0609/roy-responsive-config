import {
  FormItemType,
  IFormItem,
  IFormItemGroup,
  IFormItemProperties,
  FormItemValueType,
  IFormOption
} from './type';
import { fieldEdit, fieldGroup } from './decorator';

export class FormOption implements IFormOption {
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

  @fieldGroup({
    name: '子级选项',
    createNewFormItem() {
      return new FormOption();
    }
  })
  readonly children?: FormOption[] = [];

  constructor(value = '', name = '') {
    this.value = value;
    this.name = name;
  }
}

export class FormCondition {
  @fieldEdit({
    name: '条件字段名',
    type: 'text',
    required: true,
    readonly: false,
    properties: {
      defaultValue: '',
      placeholder: '请输入条件字段名'
    }
  })
  readonly field: string;

  @fieldEdit({
    name: '条件判断值',
    type: 'text',
    required: true,
    readonly: false,
    properties: {
      defaultValue: '',
      placeholder: '请输入条件判断值，如果有多个值则用逗号分隔'
    }
  })
  readonly value: FormItemValueType;

  constructor(field = '', value: FormItemValueType = '') {
    this.field = field;
    this.value = value;
  }
}

export class FormItemProperties implements IFormItemProperties {
  @fieldEdit({
    name: '默认值',
    type: 'text',
    required: false,
    readonly: false,
    properties: {
      defaultValue: '',
      placeholder: '请输入默认值，如果有多个值则用逗号分隔' // TODO: 后续优化这里。一个field支持附加多个fieldEdit，根据别的条件来展示哪种edit组件
    }
  })
  readonly defaultValue: FormItemValueType;

  @fieldEdit({
    name: '占位文字',
    type: 'text',
    required: false,
    readonly: false,
    properties: {
      defaultValue: '',
      placeholder: '请输入占位文字'
    },
    condition: [{ field: '../type', value: ['text', 'select', 'cascader'] }]
  })
  readonly placeholder?: string;

  @fieldGroup({
    name: '表单选项',
    condition: [
      { field: '../type', value: ['select', 'radio', 'checkbox', 'cascader'] }
    ],
    createNewFormItem() {
      return new FormOption();
    }
  })
  readonly options?: FormOption[];

  constructor(
    defaultValue: FormItemValueType = '',
    placeholder?: string,
    options?: FormOption[]
  ) {
    this.defaultValue = defaultValue;
    this.placeholder = placeholder || '';
    this.options = options || [];
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
        { value: 'cascader', name: '级联选择框' },
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
    required: false,
    readonly: false,
    properties: {
      defaultValue: false
    }
  })
  readonly required: boolean;

  @fieldEdit({
    name: '是否只读',
    type: 'switch',
    required: false,
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
    name: '显示条件',
    createNewFormItem() {
      return new FormCondition();
    }
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
    this.condition = condition || [];
  }
}

export class FormItemGroup implements IFormItemGroup {
  readonly key: string;

  readonly name: string;

  @fieldGroup({
    name: '显示条件'
  })
  readonly condition?: FormCondition[];

  children?: IFormItemGroup[];
  newFormItem?: () => void;
  deleteFormItem?: (key: number | string) => void;

  constructor(key = '', name = '', condition?: FormCondition[]) {
    this.key = key;
    this.name = name;
    this.condition = condition || [];
  }
}
