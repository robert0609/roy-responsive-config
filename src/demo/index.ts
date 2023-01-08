import { reactive, ref, toRef } from 'vue';
import { fieldEdit, fieldGroup, ResponsiveNode } from '..';

class RoyItem {
  @fieldEdit({
    name: '默认值',
    type: 'switch',
    required: false,
    readonly: false,
    properties: {
      defaultValue: false
    }
  })
  value: number;

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
  // @fieldWatch<[number]>(['value'], function (newVal, oldVal, update) {
  //   console.log(
  //     'triggered watch: ',
  //     JSON.stringify(newVal),
  //     JSON.stringify(oldVal)
  //   );
  // })
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

  // @fieldEdit({
  //   name: 'id列表',
  //   type: 'text',
  //   required: false,
  //   readonly: false,
  //   properties: {
  //     defaultValue: false,
  //     placeholder: '请输入id列表'
  //   }
  // })
  e: number[] = [3, 6];

  // @fieldWatch<[number]>(['f[0].value'], function (newVal, oldVal, update) {
  //   // this.d = 'ppp';// 注意不要死循环
  //   //@ts-ignore
  //   update([
  //     new RoyItem(8, 'hongyu'),
  //     new RoyItem(18, '56hongyu'),
  //     new RoyItem(800, 'hongyu'),
  //     new RoyItem(1800, '56hongyu')
  //   ]);
  // })
  // @syncConfig
  @fieldGroup({
    name: '属性F',
    condition: [
      {
        field: './d',
        value: 'no'
      }
    ],
    createNewFormItem() {
      return new RoyItem(-1, '');
    }
  })
  f: RoyItem[] = [new RoyItem(8, 'hongyu'), new RoyItem(18, '56hongyu')];

  g: RoyItem[] = [{ value: 9, name: 'ert' }];

  h: RoyItem = new RoyItem(1800, '56hongyu');

  constructor() {}
}

async function wait(n: number) {
  return await new Promise((resolve, reject) => {
    setTimeout(resolve, n);
  });
}

(async function () {
  const testData = new RoyData();
  const reactiveTestData = reactive(testData);
  const resData = new ResponsiveNode('reactiveTestData', ref(reactiveTestData));
  console.log('resData: ', resData);
  //@ts-ignore
  window.resData = resData;
  //@ts-ignore
  window.reactiveTestData = reactiveTestData;

  await wait(100);

  // reactiveTestData.a = false;
  // await wait(10);
  // reactiveTestData.b = 'world';
  // await wait(10);
  // reactiveTestData.c = 100;
  // await wait(10);
  // reactiveTestData.d = 'TMD';
  // await wait(10);
  // reactiveTestData.e[1] = 9;
  // await wait(10);

  // reactiveTestData.e = [1, 2, 3, 4];
  // await wait(10);
  // reactiveTestData.f[1].value = 20;
  // await wait(10);
  // reactiveTestData.f[0] = { value: 100, name: '' };
  // await wait(10);
  // reactiveTestData.g[0].name = '567';
  // await wait(10);
  // reactiveTestData.h.name = 'hname';
  // await wait(10);
  // //@ts-ignore
  // reactiveTestData.d = { a: 100 };
  // await wait(10);
  // reactiveTestData.e = [...reactiveTestData.e, 5];
  // await wait(10);
})();
