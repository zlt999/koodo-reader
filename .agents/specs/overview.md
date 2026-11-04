# Koodo Reader 架构总览与定制扩展全局注册表 (System Overview)

本文档是 Koodo Reader **原生架构基线、开发规范与 `zlt` 定制扩展层全局注册表的唯一归属技术规格文件**。

---

## 0. 项目定位与目标平台 (Positioning & Target Platform)

### 0.1 项目定位：桌面端图书管理平台

- **实际阅读主力在安卓端**：用户日常阅读主要使用官方 Koodo Reader **安卓客户端**。安卓端为官方闭源发行版，本仓库**不包含也不涉及任何安卓端源码**，无法对其做页面定制（DIY）。
- **本 Fork 的定位是“图书管理平台”**：安卓端上很多管理操作不方便做，因此本 Fork 在桌面端（见 0.2 节平台范围）以 `zlt` 定制页面的形式，补齐**图书管理**能力，而非增强阅读体验。典型需求：
  - 以**详细信息列表**形式展示所有图书（书名、作者、格式、所在书架等多列信息），便于浏览与批量操作；
  - 按**指定规则筛选**图书，例如「未放入任何书架的图书」；
  - 对筛选结果进行**批量管理**（加入/移出书架、加入书堆、收藏、删除等）。
- **设计取向**（指导所有 zlt 子页面）：
  - **信息密度与操作效率优先**：管理类页面优先采用列表/表格、多选、批量操作，而非为阅读设计的封面网格；
  - **数据必须与安卓端互通**：所有管理操作只能通过官方既有的数据结构与写入方式（`ConfigService` 配置项、`database-command` / `DatabaseService`、官方对话框与菜单）完成，**严禁引入安卓端无法识别的私有数据格式**来承载书架、书堆、收藏等业务数据，确保经官方云同步后在安卓端生效；`zlt_` 前缀配置项仅用于桌面端自身的 UI 状态（如当前 Tab）；
  - **操作行为优先复用官方组件**：右键菜单、批量操作栏、各类对话框直接复用官方实现，保证与官方（及安卓端）语义一致。

### 0.2 目标平台范围 (Target Platform Scope)

- **唯一主攻平台：Windows Portable 桌面客户端（x64）**。所有 `zlt` 定制功能优先且仅需保证在 Windows Portable 版（electron-builder `win` → `portable` 目标，产物 `Koodo Reader-<version>-x64-Portable.exe`）上的可用性与体验。
- **运行形态**：Electron 桌面端（`main.js` 主进程 + `src/` 渲染进程），可使用 `database-command` 等 IPC 及挂载点 F 提供的主进程能力；交互以鼠标/键盘为主（短按 = 左键单击，长按 = 右键菜单）。
- **Portable 版特性须知**：portable exe 每次启动解压到临时目录运行，**不要依赖安装目录或 exe 所在目录写入数据**；当前用户数据仍位于 `app.getPath("userData")`（即 `%APPDATA%\Koodo Reader`，见 `main.js` 中 `configDir` / `dirPath`）。不涉及 NSIS 安装器、文件关联注册、自动更新等安装版专属能力。
- **其它平台暂不开发**：Android（仅作为数据互通的下游阅读端，见 0.1 节，本仓库不开发）、Web（`yarn start` 纯浏览器）、macOS、Linux 及 Windows 安装版（NSIS / APPX）现阶段无需做适配、验证或特殊处理。涉及平台差异时，以 Windows Portable 版为准。

---

## 1. 原生系统架构基线 (Native Architecture Baseline)

### 1.1 四层架构总览

| 层级 | 源码位置 | 职责定位 |
| :--- | :--- | :--- |
| **Electron 主进程** | `main.js` | IPC 处理中心、本地 SQLite 数据库（better-sqlite3）、云存储同步、原生系统窗口与托盘集成 |
| **React 渲染进程** | `src/` | 页面 UI、Redux 全局状态管理、书籍交互与排版渲染 |
| **底层阅读引擎** | `src/assets/lib/kookit-extra.min.mjs` | 闭源 ESM 模块：负责书籍格式解析、SQL 语句组装、同步工具函数 |
| **Go HTTP 服务** | `httpserver/` | 可选的辅助后端服务：支持 KOReader 进度同步协议与 OPDS 书库协议集成 |

### 1.2 闭源引擎混淆库禁读警示

**严禁**直接阅读或解析 `src/assets/lib/` 下的以下压缩混淆产物：
- `kookit-extra.min.mjs`
- `kookit.min.js`
- `kookit-extra-browser.min.js`

如需查阅解析逻辑源码，请在宿主机直接查阅独立源码仓库：
- `D:\Project\kookit`
- `D:\Project\kookit-extra`

### 1.3 关键 IPC 通信通道

- **窗口与标签生命周期**：`open-book` / `new-tab` / `exit-tab` / `reader-window-close`
- **数据库操作**：`database-command`（所有本地数据库操作必须且只能通过此通道，严禁渲染进程直连）
- **云端同步通信**：`cloud-upload` / `cloud-download` / `cloud-progress`
- **阅读器优雅关闭**：`before-reader-close` → `reader-close-ready`（两阶段关闭机制）

### 1.4 Redux 切片与状态模型

- **原生切片**：`book`、`reader`、`manager`、`viewArea`、`backupPage`、`sidebar`、`progressPanel`、`collection`；
- **文件结构**：每个切片在 `src/store/actions/` 和 `src/store/reducers/` 中各对应一个同名文件；
- **状态类型**：全局状态类型 `stateType` 定义在 `src/store/index.tsx` 中，所有的 `mapStateToProps` 应统一以此为类型依据。

### 1.5 容器模式与工程分层

- **Container 组织模式**：`src/containers/` 下各模块遵循 `index.tsx` (Redux connect 包装) → `component.tsx` (组件业务实现) → `interface.tsx` (Props 与 State 类型定义)；
- **页面路由规划**：
  - `/manager/*`：主界面工作区（涵盖书库、笔记、高亮、回收站、书架等）；
  - `/epub`, `/pdf`, `/mobi`, `/txt`, `/md` 等格式路径：专用书籍阅读器；
  - `/login`, `/stats`, `/redirect`：登录认证、全屏统计面板、OAuth 协议回调。

### 1.6 支持的电子书格式列表

EPUB, PDF, MOBI, AZW3, AZW, TXT, FB2, CBR/CBZ/CBT/CB7, PPTX/PPT, XPS/OXPS, DJVU/DJV, OFD, MD, DOCX/DOC, RTF, CAJ, HTML/XML/XHTML/MHTML/HTM。

### 1.7 常用工程维护命令

```bash
# 安装依赖
yarn

# 桌面开发模式（Electron + React 热重载）
yarn dev

# Web 开发模式（纯浏览器环境）
yarn start

# 构建生产版本静态产物
yarn build

# 运行自动化单元测试
yarn test

# 桌面端打包构建分发安装包（全部目标）
yarn release

# 仅打包本项目主攻的 Windows Portable 版（x64）
yarn release --win portable --x64

# 重新编译本地原生模块
yarn rebuild
```

### 1.8 原生通用开发规范

- **多语言强制约束（仅限官方原生代码）**：修改或新增**官方原生代码**时，所有用户界面可见文本必须使用 `react-i18next` 的 `t("key")`，严禁硬编码可见字符串；
- **zlt 定制 UI 免 i18n 例外**：`src/zlt/` 下的所有定制页面与组件**一律不做国际化**，可见文本**直接硬编码简体中文**即可，无需 `t()`、无需语言包、无需注入词条。此为针对个人定制层的刻意约定（详见 [low_intrusion_standards.md](../workflows/low_intrusion_standards.md) 命名空间契约）；
- **类型安全**：TypeScript 代码应尽量避免 `any`，在各自模块的 `interface.tsx` 中完备定义接口；
- **数据库操作收口**：不要从渲染进程直接操作 SQLite，所有数据库操作必须走 `database-command` IPC；
- **日志安全原则**：不要将用户令牌、账号密码或完整本地书籍绝对路径输出到 info 级别的控制台日志中。

---

## 2. `zlt` 定制扩展层全局注册表 (Global Extension Registry)

为了与官方原生代码解耦并杜绝 Rebase 冲突，所有后续个人定制功能均通过本注册表进行纳管。

### 2.1 官方单行尾挂载点状态表 (Upstream Tail Hooks Status)

| 挂载点编号 | 目标官方文件 | 挂载方式与代码示例 | 当前状态 | 规范引用 |
| :--- | :--- | :--- | :--- | :--- |
| **Hook A** | `src/constants/sideMenu.tsx` | 尾部展开：`...zltSideMenu`（仅 1 项 zlt 工作区入口） | ✅ 已激活（永久冻结） | [low_intrusion_standards.md](../workflows/low_intrusion_standards.md#挂载点-a侧边栏菜单项--srcconstantssidemenutsx) |
| **Hook B** | `src/router/routes.tsx` | 尾部展开：`...zltManagerRoutes`（仅 1 条 `/manager/zlt` 工作区路由） | ✅ 已激活（永久冻结） | [low_intrusion_standards.md](../workflows/low_intrusion_standards.md#挂载点-b主界面工作区子路由--srcrouterroutestsx) |
| **Hook C** | `src/i18n.tsx` | 尾部调用：`registerZltI18n(i18n)` | 永久停用（zlt UI 免 i18n，全部硬编码中文） | [low_intrusion_standards.md](../workflows/low_intrusion_standards.md#挂载点-c多语言国际化动态注入--srci18ntsx) |
| **Hook D** | `src/router/index.tsx` | 顶层插入：`{renderZltTopRoutes()}` | 按需备用 | [low_intrusion_standards.md](../workflows/low_intrusion_standards.md#挂载点-d按需顶层独立全屏路由--srcrouterindextsx) |
| **Hook E** | `src/store/index.tsx` | 根切片挂载：`zlt: zltRootReducer` | 按需备用 | [low_intrusion_standards.md](../workflows/low_intrusion_standards.md#挂载点-e按需redux-全局状态--srcstoreindextsx) |
| **Hook F** | `preload.js` & `main.js` | 白名单 `"zlt-ipc"` & 尾部加载 `zlt_ipc_main.js` | 按需备用 | [low_intrusion_standards.md](../workflows/low_intrusion_standards.md#挂载点-f按需electron-主进程与-ipc--preloadjs-与-mainjs) |

*说明：挂载点在后续首次开发涉及该层能力的功能时正式激活。*

### 2.2 `zlt` 工作区架构 (Single Workspace + Tab Sub-pages)

zlt 的全部定制功能收敛在**唯一一个主界面工作区**中，不占用多个侧边栏项与官方路由：

- **侧边栏仅 1 项**：`mode: "zlt"` → 路由 `/manager/zlt`，显示中文「ZLT」工作区入口。
- **工作区容器**：`src/zlt/features/zlt_workspace/`，顶部渲染一排水平 **Tab** 栏，Tab 下方条件渲染当前激活的子页面。
- **子页面注册表**：`src/zlt/zlt_registry.ts` 导出 `zltSubPages` 数组，每个子页面登记 `{ key, title（中文）, component }`。工作区按此数组自动生成 Tab 并渲染。
- **零成本扩展**：后续新增子页面**只需在 `src/zlt/features/` 下建目录、在 `zltSubPages` 增登一行**，**完全不再触碰任何官方文件**（挂载点 A/B 一次性激活后永久冻结）。
- **当前激活 Tab 持久化**：记入 `ConfigService.getItem("zlt_activeSubPage")`，刷新后恢复。

### 2.3 `zlt` 子页面总表 (Sub-pages Registry)

| 子页面 key | Tab 标题（中文） | 功能简介 | 源码目录 | 唯一技术规格文档 | 状态 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `book_manage` | 图书管理 | 以详细信息表格展示图书，支持每列漏斗筛选（文本 / 数值 / 枚举，列内与或组合）、列显示设置、表头排序、多选与官方批量操作 / 右键菜单 | `src/zlt/features/zlt_book_manage/` | [features/zlt_book_manage.md](features/zlt_book_manage.md) | 开发中 |

### 2.4 `zlt` 可复用组件总表 (Shared Components Registry)

| 组件 | 功能简介 | 源码目录 | 唯一技术规格文档 |
| :--- | :--- | :--- | :--- |
| `ZltBookTable` | 图书详细信息表格：列设置、表头排序、单击勾选 / Shift 连选、官方 SelectBook 批量栏与 ActionDialog 菜单；各子页面传入过滤规则即可复用 | `src/zlt/components/zlt_book_table/` | [features/zlt_book_table.md](features/zlt_book_table.md) |

*维护规则：后续每新增一个子页面，必须先在本表增量登记一行，在 `zltSubPages` 注册表中追加对应项，并在 `specs/features/` 下建立该子页面的唯一归属技术规格说明书。*
