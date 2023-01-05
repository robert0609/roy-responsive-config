import {
  FormItemType,
  IFormItem,
  FormItemProperties,
  IFormItemGroup,
  IFormItemProperties
} from './type';
import { fieldEdit, fieldGroup } from './decorator';
import { isArray } from 'roy-type-assert';

export class FormOption {
  @fieldEdit<'text'>({
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

  @fieldEdit<'text'>({
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

  constructor(value: string, name: string) {
    if (value === undefined || name === undefined) {
      throw new Error(
        `创建FormOption失败：缺少必需参数[${[...arguments].join(',')}]`
      );
    }
    this.value = value;
    this.name = name;
  }

  /**
   * 尝试从json的配置数据结构中，转化为模板配置
   * @param configData
   */
  static tryParseFrom(configData: any) {
    return new FormOption(configData.value, configData.name);
  }
}

export class TextProperties implements FormItemProperties<'text'> {
  @fieldEdit<'text'>({
    name: '默认值',
    type: 'text',
    required: false,
    readonly: false,
    properties: {
      defaultValue: '',
      placeholder: '请输入默认值'
    }
  })
  readonly defaultValue: string;

  @fieldEdit<'text'>({
    name: '占位文字',
    type: 'text',
    required: false,
    readonly: false,
    properties: {
      defaultValue: '',
      placeholder: '请输入占位文字'
    }
  })
  readonly placeholder: string;

  constructor(defaultValue: string, placeholder: string) {
    if (defaultValue === undefined || placeholder === undefined) {
      throw new Error(
        `创建TextProperties失败：缺少必需参数[${[...arguments].join(',')}]`
      );
    }
    this.defaultValue = defaultValue;
    this.placeholder = placeholder;
  }

  /**
   * 尝试从json的配置数据结构中，转化为模板配置
   * @param configData
   */
  static tryParseFrom(configData: any) {
    return new TextProperties(configData.defaultValue, configData.placeholder);
  }
}

export class SelectProperties implements FormItemProperties<'select'> {
  @fieldEdit<'text'>({
    name: '默认值',
    type: 'text',
    required: false,
    readonly: false,
    properties: {
      defaultValue: '',
      placeholder: '请输入默认值'
    }
  })
  readonly defaultValue: string;

  @fieldEdit<'text'>({
    name: '占位文字',
    type: 'text',
    required: false,
    readonly: false,
    properties: {
      defaultValue: '',
      placeholder: '请输入占位文字'
    }
  })
  readonly placeholder: string;

  @fieldGroup({
    name: '下拉框选项'
  })
  readonly options: FormOption[];

  constructor(
    defaultValue: string,
    placeholder: string,
    options: FormOption[]
  ) {
    if (defaultValue === undefined || placeholder === undefined || !options) {
      throw new Error(
        `创建SelectProperties失败：缺少必需参数[${[...arguments].join(',')}]`
      );
    }
    this.defaultValue = defaultValue;
    this.placeholder = placeholder;
    this.options = options;
  }

  /**
   * 尝试从json的配置数据结构中，转化为模板配置
   * @param configData
   */
  static tryParseFrom(configData: any) {
    if (!isArray(configData.options)) {
      throw new Error(`创建SelectProperties失败：参数options不是数组`);
    }
    const options = (configData.options as unknown[]).map((o) =>
      FormOption.tryParseFrom(o)
    );
    return new SelectProperties(
      configData.defaultValue,
      configData.placeholder,
      options
    );
  }
}

export class RadioProperties implements FormItemProperties<'radio'> {
  @fieldEdit<'text'>({
    name: '默认值',
    type: 'text',
    required: false,
    readonly: false,
    properties: {
      defaultValue: '',
      placeholder: '请输入默认值'
    }
  })
  readonly defaultValue: string;

  @fieldGroup({
    name: '单选框选项'
  })
  readonly options: FormOption[];

  constructor(defaultValue: string, options: FormOption[]) {
    if (defaultValue === undefined || !options) {
      throw new Error(
        `创建RadioProperties失败：缺少必需参数[${[...arguments].join(',')}]`
      );
    }
    this.defaultValue = defaultValue;
    this.options = options;
  }

  /**
   * 尝试从json的配置数据结构中，转化为模板配置
   * @param configData
   */
  static tryParseFrom(configData: any) {
    if (!isArray(configData.options)) {
      throw new Error(`创建RadioProperties失败：参数options不是数组`);
    }
    const options = (configData.options as unknown[]).map((o) =>
      FormOption.tryParseFrom(o)
    );
    return new RadioProperties(configData.defaultValue, options);
  }
}

export class CheckboxProperties implements FormItemProperties<'checkbox'> {
  @fieldEdit<'text'>({
    name: '默认值',
    type: 'text',
    required: false,
    readonly: false,
    properties: {
      defaultValue: '',
      placeholder: '请输入默认值，多个值的话以半角逗号分隔'
    }
  })
  readonly defaultValue: string[];

  @fieldGroup({
    name: '复选框属性'
  })
  readonly options: FormOption[];

  constructor(defaultValue: string[], options: FormOption[]) {
    if (!defaultValue || !options) {
      throw new Error(
        `创建CheckboxProperties失败：缺少必需参数[${[...arguments].join(',')}]`
      );
    }
    this.defaultValue = defaultValue;
    this.options = options;
  }

  /**
   * 尝试从json的配置数据结构中，转化为模板配置
   * @param configData
   */
  static tryParseFrom(configData: any) {
    if (!isArray(configData.options)) {
      throw new Error(`创建CheckboxProperties失败：参数options不是数组`);
    }
    const options = (configData.options as unknown[]).map((o) =>
      FormOption.tryParseFrom(o)
    );
    return new CheckboxProperties(configData.defaultValue, options);
  }
}

export class SwitchProperties implements FormItemProperties<'switch'> {
  @fieldEdit<'switch'>({
    name: '默认值',
    type: 'switch',
    required: false,
    readonly: false,
    properties: {
      defaultValue: false
    }
  })
  readonly defaultValue: boolean;

  constructor(defaultValue: boolean) {
    if (defaultValue === undefined) {
      throw new Error(
        `创建SwitchProperties失败：缺少必需参数[${[...arguments].join(',')}]`
      );
    }
    this.defaultValue = defaultValue;
  }

  /**
   * 尝试从json的配置数据结构中，转化为模板配置
   * @param configData
   */
  static tryParseFrom(configData: any) {
    return new SwitchProperties(configData.defaultValue);
  }
}

export class FormItem<F extends FormItemType> implements IFormItem<F> {
  @fieldEdit<'text'>({
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

  @fieldEdit<'text'>({
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

  @fieldEdit<'select'>({
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
  readonly type: F;

  @fieldEdit<'switch'>({
    name: '是否必填',
    type: 'switch',
    required: true,
    readonly: false,
    properties: {
      defaultValue: false
    }
  })
  readonly required: boolean;

  @fieldEdit<'switch'>({
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
  readonly properties: FormItemProperties<F>;

  constructor(
    key: string,
    name: string,
    type: F,
    required: boolean,
    readonly: boolean,
    properties: FormItemProperties<F>
  ) {
    if (
      key === undefined ||
      name === undefined ||
      type === undefined ||
      required === undefined ||
      readonly === undefined ||
      properties === undefined
    ) {
      throw new Error(
        `创建FormItem失败：缺少必需参数[${[...arguments].join(',')}]`
      );
    }
    this.key = key;
    this.name = name;
    this.type = type;
    this.required = required;
    this.readonly = readonly;
    this.properties = properties;
  }

  /**
   * 尝试从json的配置数据结构中，转化为模板配置
   * @param configData
   */
  static tryParseFrom(configData: any) {
    let properties: FormItemProperties<FormItemType>;
    switch (configData.type as FormItemType) {
      case 'select': {
        properties = SelectProperties.tryParseFrom(configData.properties);
        break;
      }
      case 'radio': {
        properties = RadioProperties.tryParseFrom(configData.properties);
        break;
      }
      case 'checkbox': {
        properties = CheckboxProperties.tryParseFrom(configData.properties);
        break;
      }
      case 'switch': {
        properties = SwitchProperties.tryParseFrom(configData.properties);
        break;
      }
      default: {
        properties = TextProperties.tryParseFrom(configData.properties);
        break;
      }
    }
    return new FormItem(
      configData.key,
      configData.name,
      configData.type,
      configData.required,
      configData.readonly,
      properties
    );
  }
}

export class FormItemGroup implements IFormItemGroup {
  readonly key: string;

  readonly name: string;

  children?: (IFormItemGroup | IFormItem<FormItemType>)[];

  constructor(key: string, name: string) {
    if (key === undefined || name === undefined) {
      throw new Error(
        `创建FormItemGroup失败：缺少必需参数[${[...arguments].join(',')}]`
      );
    }
    this.key = key;
    this.name = name;
  }
}
