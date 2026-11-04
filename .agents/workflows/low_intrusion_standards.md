# Fork 仓库低侵入式增量开发与防冲突规范 (Low Intrusion Standards)

本文档是本 Fork 仓库（`zlt999/koodo-reader`）进行定制功能开发时的**低侵入架构设计、命名契约、单行尾挂载与防冲突规范的唯一归属文件**。

---

## 1. 设计初衷与冲突根因分析 (Design Rationale)

在维护开源软件的 Fork 分支并需要高频将自己的分支 `git rebase` 到官方最新提交时，常见的 Git 冲突根因主要包括：

1. **核心文件交织修改**：在官方频繁改动的组件（如 `Manager`、`Sidebar`、`Header`、`BookList`、`main.js`）内部插入自定义业务逻辑，导致官方更新时发生相邻行冲突；
2. **多语言大 JSON 冲突**：官方支持 40+ 种语言，直接在官方 `src/assets/locales/zh-CN.json` 或 `en.json` 末尾新增词条，极易因官方同时追加词条而在最后几行产生合并冲突；
3. **命名空间与路径碰撞**：开发者若随手使用通用名字（如 `src/pages/tools/`、`src/utils/ai.ts`、路由 `/tools`），未来官方若恰好也上线了同名页面或工具库，将产生严重的文件树碰撞冲突。

为此，本项目确立**四大防冲突核心原则**：
- **只增不改**：严禁修改官方已有页面的功能逻辑，新功能一律作为独立新页面或独立外置模块增量添加；
- **物理隔离**：所有个人新增代码 100% 收敛在 `src/zlt/` 目录下；
- **单行尾挂载**：官方已有入口文件每个最多仅允许追加 1 行扩展引入，后续新增任意多个功能均不再触碰官方文件；
- **特征命名**：所有新增资产强制使用 `zlt` 个人前缀，确保全系统符号唯一。

---

## 2. 个人特征命名空间与物理隔离契约 (`zlt` Namespace Contract)

所有定制资产必须严格遵循以下命名与存放契约：

| 资产类别 | 存放位置 / 命名规则 | 典型示例 | 隔离与防冲突机制 |
| :--- | :--- | :--- | :--- |
| **前端源码根目录** | `src/zlt/` | `src/zlt/` | 与官方 `src/pages/`、`src/containers/` 物理目录完全隔离 |
| **工作区容器** | `src/zlt/features/zlt_workspace/` | `src/zlt/features/zlt_workspace/` | 唯一的 zlt 主界面工作区，顶部 Tab 切换子页面；官方侧边栏/路由仅对接此容器 |
| **子页面模块目录** | `src/zlt/features/zlt_<feature>/` | `src/zlt/features/zlt_book_manage/` | 目录与文件双重前缀；新增子页面只建此目录并在注册表登记，零触碰官方文件 |
| **可复用组件目录** | `src/zlt/components/zlt_<name>/` | `src/zlt/components/zlt_book_table/` | 供多个子页面复用的 zlt 组件，同样双重前缀隔离；登记于 overview.md 2.4 节 |
| **统一聚合注册表** | `src/zlt/zlt_registry.ts` | `src/zlt/zlt_registry.ts` | 收拢唯一侧边栏项、唯一工作区路由与 `zltSubPages` 子页面数组，官方文件仅对接此注册表 |
| **主进程扩展目录** | `src/zlt/main/` | `src/zlt/main/zlt_ipc_main.js` | 独立主进程扩展模块，不往 `main.js` 塞大段函数 |
| **主界面工作区路由** | `/manager/zlt`（唯一一条） | `/manager/zlt` | 与官方 `/manager/home`、`/manager/note` 正交；全部子页面共用此路由，内部用 Tab 切换 |
| **侧边栏菜单 `mode`** | `zlt`（唯一一项） | `mode: "zlt"` | 自动复用官方 `Sidebar` 选中高亮与路由跳转能力 |
| **子页面标识 `key`** | `<feature>`（工作区内部） | `key: "book_manage"` | 仅在 `zltSubPages` 内部使用，不进入官方路由，切换由工作区本地 state 驱动 |
| **顶层独立全屏路由** | `/zlt-<feature>` | `/zlt-workspace` | 区别于官方书籍格式路由（`/epub` 等）与 `/stats` |
| **i18n 多语言** | **不适用（免 i18n）** | UI 文本直接硬编码中文 | zlt 定制 UI 一律不做国际化，可见文本直接写简体中文，无需语言包与注入；挂载点 C 永久停用 |
| **Redux 根切片** | 单一聚合键 `zlt` | `state.zlt.<feature>` | `src/store/index.tsx` 永久仅挂载一个 `zlt` 根 Reducer |
| **Electron IPC 通道** | 单一复用通道 `zlt-ipc` | `invoke("zlt-ipc", { action, payload })` | `preload.js` 白名单永久仅需声明一个通道名 |
| **持久化存储键名** | `zlt_` 前缀配置项 | `ConfigService.getItem("zlt_...")` | 杜绝污染官方 SQLite 原生表，保障云同步与备份安全 |
| **CSS 样式隔离** | 独立样式文件 + 前缀 | `.zlt-<feature>-*` | 杜绝全局 CSS 污染，样式选择器强隔离 |

---

## 2.5 复用官方代码的溯源注释规范 (Provenance Annotation for Copied Code)

当在 `src/zlt/` 内部**复制或改写官方源码片段**（如为了复用首页图书排布而拷贝 `BookList` 的渲染/分页逻辑）时，必须在复制代码处添加**溯源注释**，以便官方代码日后更新时能够追溯比对并手动同步。

1. **文件级溯源**：若整文件主要由某官方文件拷贝改写而来，在文件顶部注释块中标注来源文件路径与拷贝时的官方基线（commit 短哈希或 tag）。
2. **片段级溯源**：若仅拷贝某函数/某段逻辑，在该片段上方用单行注释标注来源文件与原函数名。
3. **改动标注**：若对拷贝来的逻辑做了个人化修改，在改动处补注 `// [zlt-mod]` 说明改了什么、为什么。

**注释格式约定**：

```tsx
/**
 * [zlt-copy] 源自官方 src/containers/lists/bookList/component.tsx (基线 <commitHash>)
 * 拷贝原因：复用首页图书网格排布与分页滚动逻辑。
 * 同步提示：官方该文件更新时，需人工比对本文件并同步必要变更。
 */
```

```tsx
// [zlt-copy] 源自 src/containers/lists/bookList/component.tsx -> handleFilterShelfBook()
const filterNotInShelf = (items) => { ... };

// [zlt-mod] 原逻辑依赖 this.props.mode；此处改为始终按“未放入书架”过滤
```

**唯一目的**：让私人代码与官方源码保持一条可追溯的血缘线，降低长期 rebase 后行为漂移的排查成本。

---

## 3. 官方已有文件“单行尾挂载（Single-Line Tail Hook）”规范

为将未来定制功能对官方文件的影响降至绝对最低，全项目已收敛并定义以下 **6 处单行尾挂载点**。

后续每当开发新功能时，**绝不允许直接往官方文件中写业务逻辑，只能通过扩充 `src/zlt/` 内部代码并在对应挂载点尾部以单行接入**。

### 挂载点 A：侧边栏菜单项 —— `src/constants/sideMenu.tsx`
- **机制**：官方 `Sidebar` 组件通过 `sideMenu.map(...)` 自动生成侧边栏按钮，并绑定点击跳转 `/manager/${item.mode}`。
- **挂载方式**：在 `src/constants/sideMenu.tsx` 文件尾部通过展开运算符合并 `zltSideMenu`：
  ```tsx
  import { zltSideMenu } from "../zlt/zlt_registry";

  export const sideMenu = [
    // ... 官方原有菜单项保持原样 ...
    {
      name: "Deleted Books",
      icon: "trash-line",
      mode: "trash",
    },
    ...zltSideMenu, // 尾部单行展开挂载
  ];
  ```
- **效果**：`src/containers/sidebar/component.tsx` **零行改动**。未来新增任意多个侧边栏页面，只需在 `src/zlt/zlt_registry.ts` 中声明即可。

### 挂载点 B：主界面工作区子路由 —— `src/router/routes.tsx`
- **机制**：官方 `Manager` 组件直接遍历 `routes` 数组并渲染子页面 `<Route>`。
- **挂载方式**：在 `src/router/routes.tsx` 文件尾部通过展开运算符合并 `zltManagerRoutes`：
  ```tsx
  import { zltManagerRoutes } from "../zlt/zlt_registry";

  export const routes = [
    // ... 官方原有路由保持原样 ...
    { path: "/manager/trash", component: DeletedBookList },
    ...zltManagerRoutes, // 尾部单行展开挂载
  ];
  ```
- **效果**：`src/pages/manager/component.tsx` **零行改动**。

### 挂载点 C：多语言国际化动态注入 —— `src/i18n.tsx`
- **机制**：`i18next` 支持在实例化后通过 `addResourceBundle` 增量追加语言资源。
- **挂载方式**：严禁修改 `src/assets/locales/` 下的任何 JSON 文件。在 `src/i18n.tsx` 的 `export default i18n;` 之前仅追加一行注入调用：
  ```tsx
  import { registerZltI18n } from "./zlt/zlt_i18n";

  // ... 官方原有 i18n.init(...) 保持原样 ...

  registerZltI18n(i18n); // 尾部单行挂载动态词条
  export default i18n;
  ```
- **实现原理**（在 `src/zlt/zlt_i18n.ts` 中维护）：
  ```typescript
  import { i18n } from "i18next";
  import zhCN from "./locales/zhCN";
  import en from "./locales/en";

  export const registerZltI18n = (instance: typeof i18n) => {
    instance.addResourceBundle("zhCN", "translation", zhCN, true, true);
    instance.addResourceBundle("en", "translation", en, true, true);
  };
  ```
- **效果**：官方 40+ 个多语言 JSON 文件保持原样，Rebase 时永不发生冲突。

### 挂载点 D（按需）：顶层独立全屏路由 —— `src/router/index.tsx`
- **机制**：若定制功能需要全屏独立页面（脱离侧边栏布局，类似官方 `/stats`），可在 `src/router/index.tsx` 的 `<Switch>` 内部插入统一的顶层路由渲染器：
  ```tsx
  {renderZltTopRoutes()} // 位于 <Route component={_Redirect} path="/" /> 之前单行插入
  ```

### 挂载点 E（按需）：Redux 全局状态 —— `src/store/index.tsx`
- **机制**：定制功能应优先使用 React 组件状态或局部 Context。若必须使用全局 Redux 状态，在 `combineReducers` 尾部仅增加一个根切片：
  ```tsx
  import { zltRootReducer, ZltStateType } from "../zlt/store/zlt_store";

  const rootReducer = combineReducers({
    // ... 官方原有 reducers ...
    zlt: zltRootReducer, // 尾部单行挂载
  });

  export type stateType = {
    // ... 官方原有 stateType 字段 ...
    zlt: ZltStateType; // 尾部单行扩展
  };
  ```
- **效果**：所有定制功能的状态与 Action 全部在 `src/zlt/store/` 内部自行组合与管理，不对官方 Redux 切片造成任何干扰。

### 挂载点 F（按需）：Electron 主进程与 IPC —— `preload.js` 与 `main.js`
- **机制**：定制功能若需要主进程 Node/系统原生能力，统一使用多路复用通道，避免通道泛滥：
  - 在 `preload.js` 的 `INVOKE_CHANNELS` 集合尾部仅追加一行：`"zlt-ipc",`；
  - 在 `main.js` 底部仅追加一行：`require("./src/zlt/main/zlt_ipc_main")({ app, ipcMain, dirPath });`；
  - 所有具体业务通过 `zlt-ipc` 传递 `{ action: "xxx", payload: ... }`，由 `zlt_ipc_main.js` 自行分发。

---

## 4. 官方上游同步与 Rebase 标准作业流程 (Upstream Sync & Rebase Runbook)

为了保证长期演进的稳定，同步上游时必须遵循以下标准作业规程：

### 4.1 远程上游配置（一次性初始化）
```bash
git remote add upstream https://github.com/koodo-reader/koodo-reader.git
git remote -v
```

### 4.2 日常同步与 Rebase 步骤
1. **确保当前工作区干净**：
   ```bash
   git status -s
   ```
2. **拉取上游最新分支**：
   ```bash
   git fetch upstream
   ```
3. **在自己的功能分支上执行 Rebase**：
   ```bash
   git rebase upstream/master  # 或上游对应主开发分支
   ```
4. **冲突预期与应对**：
   - 由于个人代码几乎 100% 位于独立的 `src/zlt/` 与 `.agents/` 目录下；
   - 官方受控文件仅在数组末尾有单行展开（`...zltSideMenu`、`...zltManagerRoutes` 等）；
   - 在绝大多数情况下，Git 会自动干净合并（Clean Merge）；
   - 若出现极少数末尾逗号冲突，直接保留双方追加行即可轻松解决。
5. **Rebase 完成后验证**：
   ```bash
   yarn test
   ```

---

## 5. 个人分支策略与合并规则 (Branch Policy)

- **个人主线分支**：`zlt-main`。官方上游同步（Rebase）与日常发布均以此分支为准；本地 `dev` 仅作官方上游镜像，禁止合入个人定制提交。
- **个人开发分支合入主线**：我自己的开发分支（如 `zlt-init-scaffold`、`zlt-*` 功能分支）合入 `zlt-main` 时，**必须使用 Squash merge**（`git merge --squash <开发分支>` 后单独提交，或平台 Squash and merge），保持主线每个功能只有一个提交；严禁普通 merge commit 或 fast-forward 带入开发分支的零碎提交。
- **执行前确认**：合并、推送属于对共享历史的操作，Agent 须先获得用户明确指令再执行。
