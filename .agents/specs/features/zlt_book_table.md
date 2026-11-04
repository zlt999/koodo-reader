# zlt 可复用组件技术规格：图书详细信息表格 (zlt_book_table)

本文件是 zlt 可复用组件 `ZltBookTable` 的**唯一归属技术规格文件**。使用该组件的子页面只描述自身的筛选规则，表格行为一律以本文件为准。

---

## 1. 功能定义

以表格形式展示一组图书（每本书一行），提供列显示设置、表头排序、多选与批量 / 单本操作。符合 [overview.md](../overview.md) 0.1 节「信息密度与操作效率优先、操作复用官方组件」的设计取向。

- 目标平台：Windows Portable 桌面客户端。
- UI 语言：全中文硬编码，不接入 i18n。

---

## 2. 源码结构

| 文件 | 职责 |
| :--- | :--- |
| `src/zlt/components/zlt_book_table/index.tsx` | Redux 容器：映射 `books / isSelectBook / selectedBooks / currentBook / isOpen*Dialog`，以及 `handleFetchBooks / handleSelectBook / handleSelectedBooks / handleReadingBook / handleActionDialog` |
| `src/zlt/components/zlt_book_table/component.tsx` | 表格本体：数据加载、行组装、筛选、排序、多选、菜单、列头漏斗筛选编排 |
| `src/zlt/components/zlt_book_table/columns.tsx` | 列定义（新增列只在 `zltColumns` 追加一项；含各列 `filterType` 声明） |
| `src/zlt/components/zlt_book_table/filterLogic.ts` | 列筛选纯逻辑：算子定义表、取值解析、单位换算、条件编译为谓词、持久化读写清洗 |
| `src/zlt/components/zlt_book_table/columnFilter.tsx` | 列头漏斗筛选浮层（受控无状态展示组件） |
| `src/zlt/components/zlt_book_table/interface.tsx` | `ZltBookRow` / `ZltColumnDef` / 筛选相关类型 / Props 类型 |
| `src/zlt/components/zlt_book_table/zlt_book_table.css` | `.zlt-book-table-*` 隔离样式（官方主题变量，跟随明暗主题） |

---

## 3. 使用方 Props

| Prop | 说明 |
| :--- | :--- |
| `storageKey` | 持久化命名空间（通常为子页面 key），各页面列设置 / 排序互不影响 |
| `filter?` | 行过滤函数 `(row: ZltBookRow) => boolean`，缺省显示全部 |
| `filterKey?` | 过滤规则标识，变化时清空已选 |
| `toolbarLeft?` | 工具栏左侧插槽（如规则筛选下拉框） |
| `emptyText?` | 空态文案 |

---

## 4. 数据来源

- **书籍列表**：`state.manager.books`（官方 `handleFetchBooks` 填充，已排除回收站；保持官方书库排序作为“不排序”时的默认顺序）。collection key 被跳过，书堆内的书本身就是独立的一行。
- **书籍详情**：`DatabaseService.getAllRecords("books")`，在渲染侧按 key 建索引并保持 `books` 原有顺序；在 `books` 变化或编辑对话框关闭后重新读取。
  - **不使用** `getRecordsByKeys("books")`：官方 `getByKeysStatement` 为 books 生成的 SQL 形如 `... WHERE key IN (?...) ORDER BY CASE key WHEN ? THEN n ... END`，需 keys 两倍参数，而 main.js 的 `database-command` handler 只传一份 data，一次性批量查询必然抛 "Too few parameter values"（官方该版本既有缺陷，不可改官方文件绕过）。
- **所在书架**：`ConfigService.getAllMapConfig("shelfList")`（shelfTitle → bookKey[]）反转为 bookKey → shelfTitle[]。
- **所在书堆**：`CollectionUtil.getCollectionList()`，跳过已删除书堆。
- **进度**：`ConfigService.getAllObjectConfig("recordLocation")[key].percentage`。
- **书名**：遵循官方 `isUseOriginalName` 设置。
- **即时刷新**：书架 / 书堆 / 进度不在 Redux 中，每次重渲染时重算；组件映射了加入书架、删除、编辑、加入书堆、操作菜单等官方对话框开关与多选状态，任一变化都会触发重渲染。

---

## 5. 列

| 列 id | 标题 | 类型 | 默认 | 排序方式 | 筛选类型（`filterType`）与可用算子 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| （复选框） | — | 固定 | 显示 | — | — |
| `name` | 书名 | 固定 | 显示 | 文本 | text：包含 / 不包含 / 开头是 / 结尾是 / 等于 / 不等于 |
| `author` | 作者 | 可选 | 显示 | 文本 | text（同上） |
| `format` | 格式 | 可选 | 显示 | 文本 | text（同上） |
| `shelves` | 所在书架 | 可选 | 显示 | 按第一个书架名，未放入书架排最后 | enum：属于其中之一 / 不属于 / 为空 / 不为空 |
| `progress` | 进度 | 可选 | 显示 | 数值 | number：大于 / 大于等于 / 等于 / 小于 / 小于等于 / 介于（按 **%** 输入，0~100） |
| `publisher` | 出版社 | 可选 | 隐藏 | 文本 | text（同上） |
| `size` | 文件大小 | 可选 | 隐藏 | 数值 | number（同进度算子；按 **MB** 输入） |
| `collection` | 所在书堆 | 可选 | 隐藏 | 文本，无书堆排最后 | enum（同所在书架算子，按单值命中） |
| （「⋯」） | — | 固定 | 显示 | — | — |

- 文本排序：`localeCompare(numeric: true, sensitivity: "base")`，「第2卷」排在「第10卷」之前；同值保持原顺序（稳定排序）。
- 表头点击循环：升序 → 降序 → 不排序。排序列被隐藏时视为不排序。
- 「列设置」面板勾选可选列，附「恢复默认」。
- **筛选取值不复用 `sortValue`**：`shelves` / `collection` 的 `sortValue` 含排序兜底（`\uffff` / `shelves[0]`），会污染筛选语义；筛选取值由 `filterLogic.getFilterValue` 按原始字段（`row.shelves` / `row.collection`）取。text/number 列的筛选取值也由 `getFilterValue` 按 `columnId` 从对应原始字段取。
- **单位换算**：`progress` 浮层按百分比 0~100 输入（标「%」），编译时除以 100 与 `row.percentage`（0~1）比较；`size` 浮层按 MB 输入（标「MB」），编译时乘 `1024*1024` 与 `row.size`（字节）比较。存储仍是用户所见单位的原始字符串。
- **0 为真实值**：`percentage` NaN 兜底 0（未读）、`size` 无记录兜底 0，均直接参与数值比较，不做跳过。

---

## 6. 交互

- **单击行**：未进入多选时进入多选并选中该行；已在多选中则切换该行勾选。
- **Shift + 单击**：从上一次单击的行（锚点）连选到当前行，与已选合并。
- **表头复选框**：全选 / 全不选当前可见行；部分选中显示半选。
- **双击**：无特别设计。
- **右键行 / 点击行尾「⋯」**：弹出官方 `ActionDialog`（定位逻辑拷贝自官方 `BookListItem.handleMoreAction`，带 `[zlt-copy]` 注释）。
- **批量操作**：多选时底部渲染官方 `<SelectBook />`（与官方首页一样位于底部，其「更多操作」弹层向上展开）。官方栏内的「全选」按官方原样保留，其范围为官方书库全集（含书堆条目），不受本表格筛选影响；按筛选结果全选请用表头复选框。
- **列头漏斗筛选**：声明了 `filterType` 的列在列头标题右侧渲染漏斗图标按钮；点击弹出该列筛选浮层（`position: fixed` + 官方 `clampMenuPosition` 视口收敛，脱离滚动容器 `overflow` 与 sticky 表头裁切）。点漏斗按钮本身、以及浮层内任一控件点击都**不触发该列排序**（漏斗 `stopPropagation` + 浮层 DOM 移出 `<th>` 子树 + 浮层容器 `stopPropagation` 三重隔离）。点浮层外部关闭。浮层打开后滚动 / 缩放时位置不跟随（与官方右键菜单一致），点外即关。
  - **浮层内容**：按列类型选择算子、添加多条条件、整列 `and|or` 连接（条件 ≥ 2 时显示切换）；text 单文本输入、number 单 / 双（between 闭区间）数值输入带 %/MB 单位后缀、enum anyOf/noneOf 多选勾选（可选值从当前数据动态去重升序）、enum isEmpty/isNotEmpty 无输入。空 / NaN / `lo>hi`（下限大于上限）/ 空多选视为无效条件，不参与过滤、不静默改写。
- **跨列 AND（与使用方 `filter` 取交集）**：各列筛选结果与使用方传入的 `filter` 一律取交集（AND）；多列之间恒 AND，不提供 OR 入口。
- **顶部 chips**：工具栏左侧为每个生效筛选列渲染一个 chip（显示列名 + ✕ 清除本列），末尾「清除全部筛选」；无生效筛选时整行不渲染。「已生效」判据与漏斗激活态、实际过滤三处同源（`compileColumnFilter` 返回非 null）。
- **筛选变化清空已选**：任一列筛选的更新 / 单列清除 / 全部清除都会清空已选并重置连选锚点（与 `filterKey` 变化同一路径）。
- **离开页面**（组件卸载）：退出多选并清空已选。

---

## 7. 持久化（仅桌面端 UI 状态）

| ConfigService 键 | 内容 |
| :--- | :--- |
| `zlt_columns_<storageKey>` | 显示的可选列 id 数组（JSON） |
| `zlt_sort_<storageKey>` | `{ columnId, order: "asc" \| "desc" }`（JSON）；不排序时移除 |
| `zlt_colfilter_<storageKey>` | 各列筛选条件 JSON：`{ [columnId]: { conjunction: "and"\|"or", conditions: [{ operator, value?, value2?, values? }] } }`；无生效筛选时移除。读取时顶层 try-catch 整体回退空对象，逐列逐条清洗：未知列 / 无 `filterType` 列、`conjunction` 非法、算子不属于该类型、数值非数、`between` 缺上限或 `lo>hi`、空多选等非法条件一律丢弃，整列无有效条件则忽略 |

所有业务数据（书架、书堆、收藏、删除）的写入均由官方对话框 / 菜单完成，本组件不写入任何业务数据；列筛选仅为桌面端 UI 状态。

---

## 8. 对官方文件的侵入

无（0 行）。

---

## 9. 验证要点

验证环境：`yarn dev`（Electron，真实书库），最终以 Windows Portable 打包产物为准。

1. 列设置勾选 / 取消即时生效，重启后保留，「恢复默认」生效；不同页面互不影响。
2. 各列表头排序循环正确，排序状态重启后保留。
3. 单击切换勾选、Shift 连选、表头全选 / 半选。
4. 官方批量栏（加入收藏 / 书架 / 书堆、删除、更多操作）可用，操作后「所在书架」「所在书堆」列即时更新。
5. 右键与「⋯」弹出官方菜单，编辑书名后表格即时更新。
6. 明暗主题下表头、选中行、标签、列设置面板颜色正常。
7. 列头漏斗出现在声明 `filterType` 的列；点漏斗 / 浮层内控件不触发排序；text/number/enum 三类算子端到端结果正确；`between` 闭区间、填反不改写；列内 and/or、多列 AND 与使用方 `filter` 取交集。
8. chips 单列 / 全部清除；无生效筛选不显示；筛选变更清空已选。
9. 列筛选重启恢复；损坏 `zlt_colfilter_<key>` 配置回退空、不崩溃。
10. 明暗主题下漏斗 / 激活态高亮（`--active-theme-color` 兜底 `--link-color`）/ 浮层 / chips 配色正常；长浮层不被滚动容器裁切、极右列不超视口右缘。
