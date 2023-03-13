import {
  reactive,
  Ref,
  toRaw,
  toRef,
  UnwrapNestedRefs,
  watch,
  WatchStopHandle
} from 'vue';
import { getFieldMetadata, IFieldMetadata } from './decorator';
import { IBaseFormItem, IFormItemGroup } from './type';
import {
  getType,
  isArray,
  isPrimitiveType as isPrimitiveTypeOriginal,
  isNull,
  VariableType
} from 'roy-type-assert';
import { FormCondition, FormItem, FormItemGroup } from './form';
import mitt, { Handler } from 'mitt';

const parentKey = Symbol('parent');

function isPrimitiveType(o: any) {
  return isPrimitiveTypeOriginal(o) || isNull(o);
}

type ResponsiveEvents = {
  ['condition']: { watchFieldPath: string[]; newVal: any };
};

const emitter = mitt<ResponsiveEvents>();

export class ResponsiveNode {
  private _reactiveConfig?: UnwrapNestedRefs<IBaseFormItem>; // 为了方便配置页的表单项之间的联动，这里做成了响应式

  get reactiveConfig() {
    return this._reactiveConfig;
  }

  private [parentKey]?: ResponsiveNode;
  private _children: ResponsiveNode[] = [];

  private _unwatches: WatchStopHandle[] = [];
  private _disposeConditionListener?: () => void;

  private _onCondition?: Handler<ResponsiveEvents['condition']>;

  private get fullPath(): string[] {
    return [...(!this[parentKey] ? [] : this[parentKey]!.fullPath), this.key];
  }

  constructor(
    public readonly key: string,
    private readonly refReactiveData: Ref<UnwrapNestedRefs<any>>,
    private readonly metadata?: IFieldMetadata,
    readonly parentReactiveConfig?: UnwrapNestedRefs<IFormItemGroup>
  ) {
    // create watcher
    this._unwatches.push(
      watch(refReactiveData, (newVal, oldVal) => {
        this.dispose({ skipDestroyOwnWatcher: true });
        // create config
        this._reactiveConfig = this.createConfig(newVal);
        if (!!parentReactiveConfig) {
          if (parentReactiveConfig.children === undefined) {
            throw new Error(
              `update config failed: parent reactive config's children is undefined`
            );
          }
          const index = this[parentKey]!._children.findIndex(
            (c) => c.key === key
          );
          //@ts-ignore
          parentReactiveConfig.children[index] = this._reactiveConfig;
        }
        // create children
        this.createChildren(newVal);

        emitter.emit('condition', { watchFieldPath: this.fullPath, newVal });
      })
    );

    // create config
    this._reactiveConfig = this.createConfig(refReactiveData.value);
    if (!!parentReactiveConfig) {
      if (parentReactiveConfig.children === undefined) {
        throw new Error(
          `add config failed: parent reactive config's children is undefined`
        );
      }
      //@ts-ignore
      parentReactiveConfig.children.push(this._reactiveConfig);
    }
    // create children
    this.createChildren(refReactiveData.value);

    // create condition watcher
    const re = this.createConditionListener();
    this._disposeConditionListener = re?.disposeConditionListener;
  }

  private createConfig(reactiveData: any) {
    if (reactiveData === undefined) {
      return;
    }
    const fieldMetadata = this.metadata;
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
        // 没有附加fieldEdit的字段，展示成只读的
        baseFormItem = reactive(
          new FormItem(this.key, this.key, 'text', false, true)
        );
      }
    } else if (fieldMetadata.groupConfig !== undefined) {
      let newFormItem: (() => void) | undefined;
      let deleteFormItem: ((key: number | string) => void) | undefined;
      if (!!fieldMetadata.groupConfig.createNewFormItem) {
        // 如果是表单项组的情况下，如果配置了新建表单项的回调函数，则这里初始化新建函数给UI调用
        newFormItem = () => {
          if (isArray(reactiveData)) {
            const arr = toRaw(reactiveData);
            this.refReactiveData.value = reactive([
              ...arr,
              fieldMetadata.groupConfig!.createNewFormItem!()
            ]);
          } else if (getType(reactiveData) === VariableType.bObject) {
            const [k, v] = fieldMetadata.groupConfig!.createNewFormItem!();
            this.refReactiveData.value = reactive(
              Object.assign({}, toRaw(reactiveData), {
                [k]: v
              })
            );
          } else {
            throw new Error(
              `Create new form item failed! fieldGroup decorator can't attached onto Non-Object or Non-Array field.`
            );
          }
        };
        deleteFormItem = (key: number | string) => {
          if (isArray(reactiveData)) {
            const arr = toRaw(reactiveData);
            arr.splice(key as number, 1);
            this.refReactiveData.value = reactive([...arr]);
          } else if (getType(reactiveData) === VariableType.bObject) {
            const obj = toRaw(reactiveData);
            delete obj[key];
            this.refReactiveData.value = reactive(Object.assign({}, obj));
          } else {
            throw new Error(
              `Create new form item failed! fieldGroup decorator can't attached onto Non-Object or Non-Array field.`
            );
          }
        };
      }
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

  private createConditionListener() {
    const conditions =
      this.metadata?.editConfig?.condition ||
      this.metadata?.groupConfig?.condition;
    if (!conditions) {
      return;
    }

    let lastReactiveData: UnwrapNestedRefs<any> | undefined;

    const checkByConditions = () => {
      if (this.checkConditions(conditions)) {
        if (lastReactiveData !== undefined) {
          this.refReactiveData.value = lastReactiveData;
          lastReactiveData = undefined;
        } else {
          // TODO: 初始化的时候，如果数据没有默认值，那么在根据condition切换状态的时候，会不知道切换成什么类型的数据
          // console.warn('初始化的时候，数据没有默认值');
        }
      } else {
        if (lastReactiveData === undefined) {
          lastReactiveData = this.refReactiveData.value;
          // 如果未满足condition条件，这里清空原始数据的值，那么对应的配置结构也被清空
          this.refReactiveData.value = undefined;
        }
      }
    };

    this._onCondition = ({
      watchFieldPath,
      newVal
    }: ResponsiveEvents['condition']) => {
      if (
        conditions.some((condition) =>
          this.pathIsWatchedCondition(watchFieldPath, condition.field)
        )
      ) {
        checkByConditions();
      }
    };
    // 创建完先执行一次
    setTimeout(() => {
      checkByConditions();
    }, 0);
    emitter.on('condition', this._onCondition);

    return {
      disposeConditionListener: () => {
        emitter.off('condition', this._onCondition);
        this._onCondition = undefined;
        if (lastReactiveData !== undefined) {
          this.refReactiveData.value = lastReactiveData;
        }
      }
    };
  }

  private createChildren(reactiveData: any) {
    if (reactiveData === undefined) {
      return;
    }
    const fieldMetadata = this.metadata;
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
            toRef(reactiveData, i),
            getFieldMetadata(reactiveData, i.toString()),
            this._reactiveConfig
          );
          this.appendChild(child);
        });
      } else {
        Object.entries(reactiveData).forEach(([k, v]) => {
          const child = new ResponsiveNode(
            k,
            toRef(reactiveData, k),
            getFieldMetadata(reactiveData, k),
            this._reactiveConfig
          );
          this.appendChild(child);
        });
      }
    }
  }

  dispose({ skipDestroyOwnWatcher = false } = {}) {
    if (!skipDestroyOwnWatcher) {
      this._unwatches.forEach((fn) => fn());
      this._unwatches = [];
      if (!!this._disposeConditionListener) {
        this._disposeConditionListener();
        this._disposeConditionListener = undefined;
      }
    }
    this._children.forEach((child) => child.dispose());

    this.clearChildren();
    this._reactiveConfig = undefined;
  }

  private setParent(parentNode?: ResponsiveNode) {
    // check if has original parent
    if (!parentNode) {
      // clear parent
      this[parentKey] = undefined;
    } else {
      // finally confirm new parent
      this[parentKey] = parentNode;
    }
  }

  private appendChild(childNode: ResponsiveNode) {
    if (this._children.findIndex((c) => c.key === childNode.key) > -1) {
      throw new Error(`append child responsive node failed: already exists`);
    }
    if (!!childNode[parentKey]) {
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

  private checkConditions(conditions: FormCondition[]) {
    let result = true;
    for (const condition of conditions) {
      let val = this.getDataByPath(condition.field);
      if (!val) {
        result = false;
      } else {
        let targetVal = condition.value;
        if (isArray(targetVal)) {
          targetVal = targetVal.map((s) => s.toString());
          if (isArray(val)) {
            val = val.map((s: any) => s.toString());
            result = val.sort().toString() === targetVal.sort().toString();
          } else {
            result = targetVal.includes(val.toString());
          }
        } else {
          if (isArray(val)) {
            result = false;
          } else {
            result = targetVal.toString() === val.toString();
          }
        }
      }
      if (!result) {
        break;
      }
    }
    return result;
  }

  private getDataByPath(fieldPath: string) {
    const node = this.getNodeByPath(fieldPath);
    return node?.refReactiveData.value;
  }

  private getNodeByPath(fieldPath: string) {
    const findParent = () => {
      if (key.length > 0) {
        if (allIsPoint) {
          if (key.length > 1) {
            // '..'
            if (!currentParentNode) {
              return false;
            }
            const nextNode = currentParentNode[parentKey];
            if (!nextNode) {
              return false;
            }
            currentParentNode = nextNode;
          }
        } else {
          // 'xx'
          if (!currentParentNode) {
            if (key === this.key) {
              currentParentNode = this;
              return true;
            } else {
              return false;
            }
          }
          const nextNode = currentParentNode._children.find(
            (node) => node.key === key
          );
          if (!nextNode) {
            return false;
          }
          currentParentNode = nextNode;
        }
      }
      key = '';
      allIsPoint = true;
      return true;
    };

    let currentParentNode = this[parentKey];
    let key = '';
    let allIsPoint = true;
    for (let i = 0; i < fieldPath.length; ++i) {
      const c = fieldPath[i];
      switch (c) {
        case '.': {
          key += c;
          break;
        }
        case '/':
        case '\\': {
          if (!findParent()) {
            return;
          }
          break;
        }
        default: {
          key += c;
          allIsPoint = false;
          break;
        }
      }
    }
    if (!findParent()) {
      return;
    }

    if (!currentParentNode) {
      return;
    }
    return currentParentNode;
  }

  private pathIsWatchedCondition(
    absolutePath: string[],
    fieldPath: string
  ): boolean {
    const node = this.getNodeByPath(fieldPath);
    if (!node) {
      return false;
    }
    const fullPath = node.fullPath;
    if (absolutePath.length !== fullPath.length) {
      return false;
    }
    for (let i = 0; i < fullPath.length; ++i) {
      if (fullPath[i] === absolutePath[i]) {
        continue;
      }
      return false;
    }
    return true;
  }
}
