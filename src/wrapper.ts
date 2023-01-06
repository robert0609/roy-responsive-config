import {
  isReactive,
  isRef,
  reactive,
  ref,
  Ref,
  toRaw,
  toRef,
  toRefs,
  UnwrapNestedRefs,
  watch,
  WatchStopHandle
} from 'vue';
import traverse from 'traverse';
import { getFieldMetadata } from './decorator';
import {
  IFormItemGroup,
  IFormItem,
  IBaseFormItem,
  isFormItemGroup
} from './type';
import {
  getType,
  isArray,
  isPrimitiveType,
  VariableType
} from 'roy-type-assert';

const rootKey = '$root';

export class ResponsiveNode {
  private _reactiveConfig: IBaseFormItem;

  private _parent?: ResponsiveNode;
  private _children: ResponsiveNode[] = [];

  constructor(
    public readonly key: string,
    public readonly name: string,
    public readonly reactiveData: Ref<any>
  ) {
    this._reactiveConfig = reactive({
      key,
      name
    });
  }

  setParent(parentNode: ResponsiveNode) {
    this._parent = parentNode;
    parentNode.appendChild(this);
    // get metadata
    const fieldMetadata = getFieldMetadata(
      parentNode.reactiveData.value,
      this.key
    );
    if (!!fieldMetadata) {
      if (fieldMetadata.autoSyncConfig === true) {
        // create auto sync config watcher
        const unwatch = watch(this.reactiveData, (newVal) => {
          // sync config
          this.syncConfig(newVal);
        });
      }
    }
  }

  private appendChild(childNode: ResponsiveNode) {
    this._children.push(childNode);
  }

  private syncConfig(newVal: any) {
    if (isPrimitiveType(newVal)) {
      // 如果原来节点的配置是group的时候，要改成表单项的配置
      if (isFormItemGroup(this._reactiveConfig)) {
        delete this._reactiveConfig.children;
        delete this._reactiveConfig.newFormItem;
        delete this._reactiveConfig.deleteFormItem;
        const n = this._reactiveConfig as IFormItem<'text'>;
        n.type = 'text';
        n.required = false;
        n.readonly = false;
        n.properties = {
          defaultValue: '',
          placeholder: `请输入${n.name}`
        };
      }
    } else {
      // object type
      if (isArray(newVal)) {
        newVal.forEach((val, idx) => {
          const strIdx = idx.toString();
          const childNode = new ResponsiveNode(strIdx, strIdx, ref(val));
          childNode.setParent(this);
        });
      } else {
      }
    }
  }

  private getConfigNodeByPath(configNode: IFormItemGroup, path: string[]) {
    let node = configNode;
    path.forEach((p) => {
      let nextNode: IFormItemGroup | undefined;
      if (node.children !== undefined && node.children.length > 0) {
        nextNode = node.children.find((c) => c.key === p);
      }
      if (!nextNode) {
        throw new Error(`解析模板配置失败：未找到[${p}]字段`);
      }
      node = nextNode;
    });
    return node;
  }

  private generateConfig(
    key: string,
    name: string,
    nodeData: object,
    parentPath: string[] = []
  ): IFormItemGroup {
    const root: IFormItemGroup = {
      key,
      name,
      children: []
    };

    const that = this // eslint-disable-line
    traverse(nodeData).forEach(function (val) {
      if (!this.parent) {
        return;
      }
      const configNode = that.getConfigNodeByPath(
        root,
        this.path.slice(0, this.path.length - 1)
      );
      if (configNode.children === undefined) {
        configNode.children = [];
      }
      const p = this.key!;
      const fieldMetadata = getFieldMetadata(this.parent.node, p);
      if (
        fieldMetadata === undefined ||
        (fieldMetadata.groupConfig === undefined &&
          fieldMetadata.editConfig === undefined)
      ) {
        if (isArray(val) || getType(val) === VariableType.bObject) {
          configNode.children.push({
            key: p,
            name: p.toString(),
            children: []
          });
        } else {
          configNode.children.push({
            key: p,
            name: p,
            type: 'text',
            required: false,
            readonly: false,
            properties: {
              defaultValue: '',
              placeholder: `请输入${p}`
            }
          } as IFormItem<'text'>);
        }
      } else if (fieldMetadata.groupConfig !== undefined) {
        let newFormItem: (() => void) | undefined;
        let deleteFormItem: ((key: number | string) => void) | undefined;
        // if (!!fieldMetadata.groupConfig.createNewFormItem) {
        //   // 如果是表单项组的情况下，如果配置了新建表单项的回调函数，则这里初始化新建函数给UI调用
        //   newFormItem = () => {
        //     const currentVal = this.parent!.node[p];
        //     if (isArray(currentVal)) {
        //       const arr = toRaw(currentVal);
        //       arr.push(fieldMetadata.groupConfig!.createNewFormItem!());
        //       this.parent!.node[p] = arr;
        //     } else if (getType(currentVal) === VariableType.bObject) {
        //       const [k, v] = fieldMetadata.groupConfig!.createNewFormItem!();
        //       this.parent!.node[p] = Object.assign({}, toRaw(currentVal), {
        //         [k]: v
        //       });
        //     } else {
        //       throw new Error(
        //         `Create new form item failed! fieldGroup decorator can't attached onto Non-Object or Non-Array field.`
        //       );
        //     }
        //     that.patchConfig(
        //       [...parentPath, ...this.parent!.path],
        //       p,
        //       this.parent!.node[p]
        //     );
        //   };

        //   deleteFormItem = (key: number | string) => {
        //     const currentVal = this.parent!.node[p];
        //     if (isArray(currentVal)) {
        //       const arr = toRaw(currentVal);
        //       arr.splice(key as number, 1);
        //       this.parent!.node[p] = arr;
        //     } else if (getType(currentVal) === VariableType.bObject) {
        //       const obj = toRaw(currentVal);
        //       delete obj[key];
        //       this.parent!.node[p] = Object.assign({}, obj);
        //     } else {
        //       throw new Error(
        //         `Create new form item failed! fieldGroup decorator can't attached onto Non-Object or Non-Array field.`
        //       );
        //     }
        //     that.patchConfig(
        //       [...parentPath, ...this.parent!.path],
        //       p,
        //       this.parent!.node[p]
        //     );
        //   };
        // }
        configNode.children.push({
          key: p,
          name: fieldMetadata.groupConfig.name,
          newFormItem,
          deleteFormItem,
          children: []
        });
      } else if (fieldMetadata.editConfig !== undefined) {
        configNode.children.push({
          key: p,
          ...fieldMetadata.editConfig
        });
      }
    });
    return root;
  }
}

export class Responsive<T extends object = object> {
  private _reactiveData = reactive<{
    [rootKey]: object;
  }>({ [rootKey]: {} });

  get value() {
    return this._reactiveData[rootKey] as T;
  }

  private _config: IFormItemGroup = reactive<IFormItemGroup>({
    key: '',
    name: '',
    children: []
  });

  get config() {
    if (
      this._config.children === undefined ||
      this._config.children.length === 0
    ) {
      return;
    } else {
      return this._config.children[0];
    }
  }

  private _unwatches: WatchStopHandle[] = [];

  constructor(originalData: T) {
    this._reactiveData[rootKey] = originalData;

    const that = this // eslint-disable-line
    const traverseData = traverse(this._reactiveData);
    traverseData.forEach(function (val) {
      if (!this.parent) {
        return;
      }
      const p = this.key!;
      const fieldMetadata = getFieldMetadata(this.parent.node, p);
      if (fieldMetadata !== undefined) {
        if (fieldMetadata.watch !== undefined) {
          // 建立watch监听器
          const watchSources = fieldMetadata!.watch!.fieldNames.map(
            (fieldName) => () => {
              const path = [
                ...this.path.slice(0, this.path.length - 1),
                ...fieldName.split(/[\.\[\]'"]/gi).filter((s) => !!s)
              ];
              return traverseData.get(path);
            }
          );
          const unwatch = watch(watchSources, (newVal, oldVal) => {
            fieldMetadata.watch!.handler(newVal, oldVal, (nodeData) => {
              const original = isRef(nodeData)
                ? nodeData.value
                : isReactive(nodeData)
                ? toRaw(nodeData)
                : nodeData;
              // 更细响应式数据
              this.parent!.node[p] = original;
            });
          });
          that._unwatches.push(unwatch);
        }

        if (fieldMetadata.autoSyncConfig === true) {
          const unwatch = watch(
            () => traverseData.get(this.path),
            (newVal) => {
              // 更新响应式配置数据
              const original = isRef(newVal)
                ? newVal.value
                : isReactive(newVal)
                ? toRaw(newVal)
                : newVal;
              that.patchConfig.call(that, this.parent!.path, p, original);
            }
          );
          that._unwatches.push(unwatch);
        }
      }
    });

    // 生成初始配置数据
    this._config.children = [
      this.generateConfig(rootKey, 'root', originalData, [rootKey])
    ];
  }

  dispose() {
    this._unwatches.forEach((unwatch) => unwatch());
  }

  private patchConfig(
    parentPath: string[], // IMPORTANCE:这个参数一定要从根开始
    fieldPath: string,
    nodeData: unknown
  ) {
    const path = [
      ...parentPath,
      ...fieldPath.split(/[\.\[\]'"]/gi).filter((s) => !!s)
    ];
    const oldConfigNode = this.getConfigNodeByPath(this._config, path);
    if (isPrimitiveType(nodeData)) {
      // 如果原来节点的配置是group的时候，要改成表单项的配置
      //@ts-ignore
      if (oldConfigNode.type === undefined) {
        delete oldConfigNode.children;
        delete oldConfigNode.newFormItem;
        delete oldConfigNode.deleteFormItem;
        const n = oldConfigNode as IFormItem<'text'>;
        n.type = 'text';
        n.required = false;
        n.readonly = false;
        n.properties = {
          defaultValue: '',
          placeholder: `请输入${n.name}`
        };
      }
    } else {
      const newConfigNode = this.generateConfig(
        oldConfigNode.key,
        oldConfigNode.name,
        nodeData as object,
        path
      );
      oldConfigNode.children = newConfigNode.children;
      // 存在子节点的情况下，要把原来的节点配置改成group
      //@ts-ignore
      delete oldConfigNode['type'];
      //@ts-ignore
      delete oldConfigNode['required'];
      //@ts-ignore
      delete oldConfigNode['readonly'];
      //@ts-ignore
      delete oldConfigNode['properties'];
    }
  }

  private getConfigNodeByPath(configNode: IFormItemGroup, path: string[]) {
    let node = configNode;
    path.forEach((p) => {
      let nextNode: IFormItemGroup | undefined;
      if (node.children !== undefined && node.children.length > 0) {
        nextNode = node.children.find((c) => c.key === p);
      }
      if (!nextNode) {
        throw new Error(`解析模板配置失败：未找到[${p}]字段`);
      }
      node = nextNode;
    });
    return node;
  }

  private generateConfig(
    key: string,
    name: string,
    nodeData: object,
    parentPath: string[] = []
  ): IFormItemGroup {
    const root: IFormItemGroup = {
      key,
      name,
      children: []
    };

    const that = this // eslint-disable-line
    traverse(nodeData).forEach(function (val) {
      if (!this.parent) {
        return;
      }
      const configNode = that.getConfigNodeByPath(
        root,
        this.path.slice(0, this.path.length - 1)
      );
      if (configNode.children === undefined) {
        configNode.children = [];
      }
      const p = this.key!;
      const fieldMetadata = getFieldMetadata(this.parent.node, p);
      if (
        fieldMetadata === undefined ||
        (fieldMetadata.groupConfig === undefined &&
          fieldMetadata.editConfig === undefined)
      ) {
        if (isArray(val) || getType(val) === VariableType.bObject) {
          configNode.children.push({
            key: p,
            name: p.toString(),
            children: []
          });
        } else {
          configNode.children.push({
            key: p,
            name: p,
            type: 'text',
            required: false,
            readonly: false,
            properties: {
              defaultValue: '',
              placeholder: `请输入${p}`
            }
          } as IFormItem<'text'>);
        }
      } else if (fieldMetadata.groupConfig !== undefined) {
        let newFormItem: (() => void) | undefined;
        let deleteFormItem: ((key: number | string) => void) | undefined;
        if (!!fieldMetadata.groupConfig.createNewFormItem) {
          // 如果是表单项组的情况下，如果配置了新建表单项的回调函数，则这里初始化新建函数给UI调用
          newFormItem = () => {
            const currentVal = this.parent!.node[p];
            if (isArray(currentVal)) {
              const arr = toRaw(currentVal);
              arr.push(fieldMetadata.groupConfig!.createNewFormItem!());
              this.parent!.node[p] = arr;
            } else if (getType(currentVal) === VariableType.bObject) {
              const [k, v] = fieldMetadata.groupConfig!.createNewFormItem!();
              this.parent!.node[p] = Object.assign({}, toRaw(currentVal), {
                [k]: v
              });
            } else {
              throw new Error(
                `Create new form item failed! fieldGroup decorator can't attached onto Non-Object or Non-Array field.`
              );
            }
            that.patchConfig(
              [...parentPath, ...this.parent!.path],
              p,
              this.parent!.node[p]
            );
          };

          deleteFormItem = (key: number | string) => {
            const currentVal = this.parent!.node[p];
            if (isArray(currentVal)) {
              const arr = toRaw(currentVal);
              arr.splice(key as number, 1);
              this.parent!.node[p] = arr;
            } else if (getType(currentVal) === VariableType.bObject) {
              const obj = toRaw(currentVal);
              delete obj[key];
              this.parent!.node[p] = Object.assign({}, obj);
            } else {
              throw new Error(
                `Create new form item failed! fieldGroup decorator can't attached onto Non-Object or Non-Array field.`
              );
            }
            that.patchConfig(
              [...parentPath, ...this.parent!.path],
              p,
              this.parent!.node[p]
            );
          };
        }
        configNode.children.push({
          key: p,
          name: fieldMetadata.groupConfig.name,
          newFormItem,
          deleteFormItem,
          children: []
        });
      } else if (fieldMetadata.editConfig !== undefined) {
        configNode.children.push({
          key: p,
          ...fieldMetadata.editConfig
        });
      }
    });
    return root;
  }
}
