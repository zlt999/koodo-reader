# zlt 子页面技术规格：图书管理 (zlt_book_manage)

本文件是 zlt 工作区「图书管理」子页面的**唯一归属技术规格文件**。

---

## 1. 功能定义

在 zlt 工作区中以独立 Tab 呈现「图书管理」子页面：以详细信息表格展示全部图书并支持批量管理。表格的列、排序、多选、菜单、每列筛选行为见 [zlt_book_table.md](zlt_book_table.md)。

- 目标平台：Windows Portable 桌面客户端。
- UI 语言：全中文硬编码，不接入 i18n。
- 本页取代早期的「未上架」子页面（已移除）。
- 本页不再提供顶部规则下拉框（全部 / 未放入书架 / 各书架）；筛选一律由表格每列的漏斗筛选承担（例如「所在书架」列选「为空」即等价于原“未放入书架”）。

---

## 2. 归属与路由

- 侧边栏入口 `mode: "zlt"` → 路由 `/manager/zlt` → zlt 工作区容器（见 [overview.md](../overview.md) 2.2 节）。
- 子页面标识：`key: "book_manage"`，Tab 标题「图书管理」。
- 旧的 `zlt_activeSubPage = "unshelved"` 记录无需迁移：工作区找不到对应 Tab 时自动回退到第一项。

---

## 3. 源码结构

| 文件 | 职责 |
| :--- | :--- |
| `src/zlt/features/zlt_book_manage/index.tsx` | 入口，直接导出组件（页面本身无 Redux 状态） |
| `src/zlt/features/zlt_book_manage/component.tsx` | 渲染 `ZltBookTable`（`storageKey: "book_manage"`） |
| `src/zlt/features/zlt_book_manage/zlt_book_manage.css` | `.zlt-book-manage` 隔离样式 |

---

## 4. 遗留数据

早期版本的规则下拉框曾在 `ConfigService` 写入键 `zlt_filter_book_manage`。该键已不再读取，残留值无影响，无需迁移。

---

## 5. 对官方文件的侵入

无（0 行）。挂载点 A / B 已激活且冻结，本页仅在 `src/zlt/zlt_registry.ts` 的 `zltSubPages` 中登记。

---

## 6. 验证要点

验证环境：`yarn dev`（Electron，真实书库）。

1. ZLT 工作区出现「图书管理」Tab（且为默认 Tab），工具栏不再有规则下拉框。
2. 表格显示全部图书；用「所在书架」列漏斗选「为空」可得到未放入书架的图书。
3. 在筛选结果下将书加入书架后，该行按筛选条件即时更新。
4. 表格相关验证见 [zlt_book_table.md](zlt_book_table.md) 第 9 节。
