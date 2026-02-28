/**
 * 响应式配置树：将「普通数据 + 装饰器元数据」转为 Vue 响应式的表单配置结构。
 *
 * 核心类 ResponsiveNode 以树形结构对应源数据，每个节点根据 @fieldEdit / @fieldGroup 生成
 * FormItem 或 FormItemGroup，并支持基于 condition 的显隐联动与路径解析（含 '..'）。
 */
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

/**
 * 响应式配置树节点。
 *
 * 将「普通数据 + 装饰器元数据」转换为 Vue 响应式的表单配置结构（IBaseFormItem/FormItemGroup），
 * 供配置页渲染表单项并支持表单项之间的条件联动。
 *
 * 职责概览：
 * - 树形结构：每个节点对应数据中的一个字段（key），与源数据同构；通过 parent/children 维护树关系。
 * - 数据驱动：监听 refReactiveData 变化，重新生成 reactiveConfig 和子节点，并同步到父节点的 children。
 * - 配置生成：根据 @fieldEdit / @fieldGroup 元数据或无元数据，生成可编辑表单项、只读项或分组（含 newFormItem/deleteFormItem）。
 * - 条件联动：通过 mitt 监听 'condition' 事件，当依赖字段路径变化时校验 condition；不满足时清空当前节点数据与配置。
 * - 路径解析：支持相对路径（含 '..'）查找节点，用于 condition.field 与事件中的 watchFieldPath 匹配。
 *
 * 生命周期：构造时创建 watcher 与 condition 监听；dispose 时取消所有 watcher、condition 监听并递归销毁子节点。
 */
export class ResponsiveNode {
  /** 当前节点对应的响应式表单配置（FormItem 或 FormItemGroup），供配置页绑定与联动 */
  private _reactiveConfig?: UnwrapNestedRefs<IBaseFormItem>; // 为了方便配置页的表单项之间的联动，这里做成了响应式

  get reactiveConfig() {
    return this._reactiveConfig;
  }

  /** 父节点（用于 fullPath 与 getNodeByPath 的向上查找） */
  private [parentKey]?: ResponsiveNode;
  /** 子节点列表，与当前节点在数据上的子字段一一对应 */
  private _children: ResponsiveNode[] = [];

  /** 本节点注册的 watch 的 stop 句柄，用于 dispose 时统一取消 */
  private _unwatches: WatchStopHandle[] = [];
  /** 取消 condition 事件监听的函数 */
  private _disposeConditionListener?: () => void;

  /** condition 事件的处理函数，用于在依赖字段变化时重新校验并可能清空/恢复当前节点数据 */
  private _onCondition?: Handler<ResponsiveEvents['condition']>;

  /** 从根节点到当前节点的 key 路径数组，用于 condition 事件中的 watchFieldPath 匹配 */
  private get fullPath(): string[] {
    return [...(!this[parentKey] ? [] : this[parentKey]!.fullPath), this.key];
  }

  /**
   * @param key 当前节点在父级数据中的字段名（或数组下标字符串）
   * @param refReactiveData 指向当前字段值的 Ref，变化时会触发整棵子树的重建
   * @param metadata 当前字段的 @fieldEdit / @fieldGroup 元数据，决定生成表单项还是分组及条件等
   * @param parentReactiveConfig 父节点对应的 FormItemGroup 的响应式对象，用于把本节点的 reactiveConfig 写入其 children
   */
  constructor(
    public readonly key: string,
    private readonly refReactiveData: Ref<UnwrapNestedRefs<any>>,
    private readonly metadata?: IFieldMetadata,
    readonly parentReactiveConfig?: UnwrapNestedRefs<IFormItemGroup>
  ) {
    // 监听源数据变化：先销毁子节点与 watcher（保留自身 watcher），再按新值重建 config 与子节点，并通知 condition
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

    // 初始：根据当前值生成 config 并挂到父级 children
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

    // 若当前字段配置了 condition，则订阅 condition 事件并在依赖字段变化时校验/清空
    const re = this.createConditionListener();
    this._disposeConditionListener = re?.disposeConditionListener;
  }

  /**
   * 根据当前字段的 reactiveData 与 metadata 生成一条表单配置（FormItem 或 FormItemGroup）。
   * - 无 metadata 或两者都无：对象/数组 -> FormItemGroup(children=[])；基本类型 -> 只读 FormItem('text')。
   * - 有 groupConfig：生成带 name/newFormItem/deleteFormItem/condition 的 FormItemGroup。
   * - 仅有 editConfig：生成可编辑 FormItem（展开 editConfig）。
   */
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
        // 无装饰器的基本类型字段，在配置页展示为只读文本
        baseFormItem = reactive(
          new FormItem(this.key, this.key, 'text', false, true)
        );
      }
    } else if (fieldMetadata.groupConfig !== undefined) {
      let newFormItem: (() => void) | undefined;
      let deleteFormItem: ((key: number | string) => void) | undefined;
      if (!!fieldMetadata.groupConfig.createNewFormItem) {
        // 表单项组且配置了 createNewFormItem 时，为 UI 提供“新增一项”的实现（数组 push / 对象 assign）
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

  /**
   * 若当前节点配置了 condition（editConfig 或 groupConfig 上的 condition），则：
   * - 订阅 'condition' 事件；当事件中的 watchFieldPath 与任一 condition.field 对应节点一致时，执行校验。
   * - 满足条件：若有上次缓存的 lastReactiveData 则写回，否则保持（初始化无默认值时仅保持）。
   * - 不满足条件：缓存当前值到 lastReactiveData，并将 refReactiveData 置为 undefined，从而清空配置与子节点。
   * 返回 { disposeConditionListener } 供 dispose 时取消订阅并可选恢复 lastReactiveData。
   */
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
          // 不满足 condition：清空源数据，触发 watcher 后配置树对应部分会被清空
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
    // 挂载后先异步执行一次，处理初始状态下的显隐
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

  /**
   * 根据 metadata 与 reactiveData 类型决定是否创建子节点：无 metadata 或仅有 groupConfig 且非基本类型时，调用 innerCreateChildren。
   */
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

  /**
   * 对数组按索引、对对象按 key 为每个子项创建 ResponsiveNode，并挂到当前节点的 _children 与 parentReactiveConfig.children。
   */
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

  /**
   * 销毁当前节点：取消本节点 watcher 与 condition 监听（除非 skipDestroyOwnWatcher）、递归 dispose 子节点、
   * 清空 _children 与 parent 引用，并将 _reactiveConfig 置为 undefined。
   * skipDestroyOwnWatcher：在 refReactiveData 的 watch 回调里重建子树时使用，避免把正在用的 watcher 停掉。
   */
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

  /** 设置或清除当前节点的父节点引用（用于 fullPath 与 getNodeByPath） */
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

  /** 将子节点加入 _children 并设置其 parent 为当前节点；禁止重复 key 或已有父节点 */
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

  /** 从 _children 中移除指定子节点并清除其 parent 引用 */
  private removeChild(childNode: ResponsiveNode) {
    const deleteIndex = this._children.findIndex(
      (c) => c.key === childNode.key
    );
    if (deleteIndex > -1) {
      this._children.splice(deleteIndex, 1);

      childNode.setParent();
    }
  }

  /** 清除所有子节点的 parent 引用并清空 _children */
  private clearChildren() {
    this._children.forEach((childNode) => childNode.setParent());
    this._children = [];
  }

  /**
   * 校验当前节点是否满足所有 condition：每个 condition 的 field 通过 getDataByPath 解析，
   * 值与 condition.value 比较（支持数组、多选匹配）。全部满足返回 true，否则 false。
   */
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

  /** 根据相对路径 fieldPath 找到对应节点并返回其 refReactiveData.value */
  private getDataByPath(fieldPath: string) {
    const node = this.getNodeByPath(fieldPath);
    return node?.refReactiveData.value;
  }

  /**
   * 根据相对路径 fieldPath 从当前节点解析到目标 ResponsiveNode。
   * 路径支持 '.' 分隔与 '..' 表示父级，如 'a/b/../c'；解析起点为当前节点的父节点（即 currentParentNode 初始为 this[parentKey]）。
   */
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

  /**
   * 判断 condition 监听的字段路径 fieldPath 对应的节点，其 fullPath 是否与事件中的绝对路径 absolutePath 完全一致。
   * 用于 condition 事件回调中筛选“是否本次变化的字段正是本节点所依赖的字段”。
   */
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
