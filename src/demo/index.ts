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

  @fieldWatch<number, RoyData>('c', function (newVal, oldVal) {
    console.log('triggered watch: ', this, newVal, oldVal);
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
