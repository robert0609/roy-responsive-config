import { fieldWatch, fieldEdit, fieldGroup, syncConfig, Responsive } from '..';

class RoyItem {
  @fieldEdit<'switch'>({
    name: '默认值',
    type: 'switch',
    required: false,
    readonly: false,
    properties: {
      defaultValue: false
    }
  })
  value: number;

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
  @fieldWatch<[number]>(['value'], function (newVal, oldVal, update) {
    console.log(
      'triggered watch: ',
      JSON.stringify(newVal),
      JSON.stringify(oldVal)
    );
  })
  name: string;

  constructor(value: number, name: string) {
    this.value = value;
    this.name = name;
  }
}

export class RoyData {
  a = true;

  b = 'hello';

  c = 10;

  d?: string;

  e: number[] = [3, 6];

  @fieldWatch<[number]>(['f[0].value'], function (newVal, oldVal, update) {
    // this.d = 'ppp';// 注意不要死循环
    //@ts-ignore
    update([
      new RoyItem(8, 'hongyu'),
      new RoyItem(18, '56hongyu'),
      new RoyItem(800, 'hongyu'),
      new RoyItem(1800, '56hongyu')
    ]);
  })
  @syncConfig
  @fieldGroup({
    name: '属性F',
    createNewFormItem() {
      return new RoyItem(-1, '');
    }
  })
  f: RoyItem[] = [new RoyItem(8, 'hongyu'), new RoyItem(18, '56hongyu')];

  g: RoyItem[] = [{ value: 9, name: 'ert' }];

  constructor() {}
}

(function () {
  const testData = new RoyData();
  const resData = new Responsive<RoyData>(testData);
  console.log('resData: ', resData);
  //@ts-ignore
  window.resData = resData;
})();
