# roy-responsive-config

> responsive data wrapper that could automatically generate config interface

## Build Setup

``` bash
# install dependencies
npm install

# start development server for debug
npm run dev

# build in production
npm run build
```

1. 新加的表单项，里面没有建立成功：相应数据的监听器
2. 从select切回text会报options找不到

## demo

实际程序运行中使用的配置数据结构

```json
{
  control1: true,
  control2: false,
  attributes: [
    {
      key: 'P1',
      name: '属性1',
      type: 'select',
      required: false,
      properties: {
        defaultValue: '',
        placeholder: '',
        options: [
          { value: '0', name: '0000' },
          { value: '1', name: '1111' }
        ]
      },
      condition: [
        { field: 'P2', value: '1' }
      ]
    },
    {
      key: 'P2',
      name: '属性2',
      type: 'text',
      required: false,
      properties: {
        defaultValue: '',
        placeholder: ''
      }
    }
  ]
}
```
