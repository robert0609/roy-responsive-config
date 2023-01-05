import { fieldWatch, Responsive } from '..';

class RoyItem {
  value: number;

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

  @fieldWatch<
    [boolean, string, number, string | undefined, number[], RoyItem[]],
    RoyData
  >(['a', 'b', 'c', 'd', 'e', 'g'], function (newVal, oldVal) {
    console.log(
      'triggered watch: ',
      this,
      JSON.stringify(newVal),
      JSON.stringify(oldVal)
    );
    if (newVal[2] === 11) {
      // this.d = 'ppp';// 注意不要死循环
      this.e = [1, 2, 3];
    }
  })
  f: RoyItem = new RoyItem(8, 'hongyu');

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
