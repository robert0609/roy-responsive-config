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
import { FormItem, FormItemGroup } from './form';

const rootKey = '$root';

export class ResponsiveNode {
  private _reactiveConfig: UnwrapNestedRefs<IBaseFormItem>;

  private _parent?: ResponsiveNode;
  private _children: ResponsiveNode[] = [];

  private _unwatches: WatchStopHandle[] = [];

  constructor(
    public readonly key: string,
    private readonly refReactiveData: Ref<UnwrapNestedRefs<any>>
  ) {
    // create watcher
    this._unwatches.push(
      watch(refReactiveData, (newVal, oldVal) => {
        this.dispose({ skipDestroyOwnWatcher: true });
        // create config
        this._reactiveConfig = this.createConfig(newVal);
        // create children
        this.createChildren(newVal);
      })
    );

    // create config
    this._reactiveConfig = this.createConfig(refReactiveData.value);
    // create children
    this.createChildren(refReactiveData.value);
  }

  private createConfig(reactiveData: any) {
    const fieldMetadata = !this._parent
      ? undefined
      : getFieldMetadata(this._parent.refReactiveData.value, this.key);
    let baseFormItem: IBaseFormItem;
    if (
      fieldMetadata === undefined ||
      (fieldMetadata.groupConfig === undefined &&
        fieldMetadata.editConfig === undefined)
    ) {
      if (
        isArray(reactiveData) ||
        getType(reactiveData) === VariableType.bObject
      ) {
        const item = new FormItemGroup(this.key, this.key);
        item.children = [];
        baseFormItem = reactive(item);
      } else {
        baseFormItem = reactive(new FormItem(this.key, this.key));
      }
    } else if (fieldMetadata.groupConfig !== undefined) {
      let newFormItem: (() => void) | undefined;
      let deleteFormItem: ((key: number | string) => void) | undefined;
      baseFormItem = reactive({
        key: this.key,
        name: fieldMetadata.groupConfig.name,
        newFormItem,
        deleteFormItem,
        children: [],
        condition: fieldMetadata.groupConfig.condition
      });
    } else {
      baseFormItem = reactive({
        key: this.key,
        ...fieldMetadata.editConfig!
      });
    }
    return baseFormItem;
  }

  private createChildren(reactiveData: any) {
    const fieldMetadata = !this._parent
      ? undefined
      : getFieldMetadata(this._parent.refReactiveData.value, this.key);
    if (
      fieldMetadata === undefined ||
      (fieldMetadata.groupConfig === undefined &&
        fieldMetadata.editConfig === undefined)
    ) {
      this.innerCreateChildren(reactiveData);
    } else if (fieldMetadata.groupConfig !== undefined) {
      if (isPrimitiveType(reactiveData)) {
        throw new Error(
          `create children failed: it can't attach fieldGroup on primitive type field`
        );
      } else {
        this.innerCreateChildren(reactiveData);
      }
    }
  }

  private innerCreateChildren(reactiveData: any) {
    if (!isPrimitiveType(reactiveData)) {
      if (isArray(reactiveData)) {
        reactiveData.forEach((v, i) => {
          const child = new ResponsiveNode(
            i.toString(),
            toRef(reactiveData, i)
          );
          this.appendChild(child);
        });
      } else {
        Object.entries(reactiveData).forEach(([k, v]) => {
          const child = new ResponsiveNode(k, toRef(reactiveData, k));
          this.appendChild(child);
        });
      }
    }
  }

  private dispose({ skipDestroyOwnWatcher = false } = {}) {
    if (!skipDestroyOwnWatcher) {
      this._unwatches.forEach((fn) => fn());
      this._unwatches = [];
    }
    this._children.forEach((child) => child.dispose());

    this.clearChildren();
    this._reactiveConfig = reactive({ key: this.key, name: this.key });
  }

  private setParent(parentNode?: ResponsiveNode) {
    // check if has original parent
    if (!parentNode) {
      // clear parent
      this._parent = undefined;
    } else {
      // finally confirm new parent
      this._parent = parentNode;
    }
  }

  private appendChild(childNode: ResponsiveNode) {
    if (this._children.findIndex((c) => c.key === childNode.key) > -1) {
      throw new Error(`append child responsive node failed: already exists`);
    }
    if (!!childNode._parent) {
      throw new Error(
        `append child responsive node failed: child already has another parent`
      );
    }
    this._children.push(childNode);

    childNode.setParent(this);
  }

  private removeChild(childNode: ResponsiveNode) {
    const deleteIndex = this._children.findIndex(
      (c) => c.key === childNode.key
    );
    if (deleteIndex > -1) {
      this._children.splice(deleteIndex, 1);

      childNode.setParent();
    }
  }

  private clearChildren() {
    this._children.forEach((childNode) => childNode.setParent());
    this._children = [];
  }

  private syncConfig(newVal: any) {
    if (isPrimitiveType(newVal)) {
      // 如果原来节点的配置是group的时候，要改成表单项的配置 TODO: ResponsiveNode测试一下这个情况
      if (isFormItemGroup(this._reactiveConfig)) {
        delete this._reactiveConfig.children;
        delete this._reactiveConfig.newFormItem;
        delete this._reactiveConfig.deleteFormItem;
        const n = this._reactiveConfig as IFormItem;
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
          const childNode = new ResponsiveNode(strIdx, ref(val));
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
          } as IFormItem);
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
        const n = oldConfigNode as IFormItem;
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
          } as IFormItem);
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
