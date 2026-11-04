/**
 * zlt 统一聚合注册表
 *
 * 本文件是 zlt 定制扩展层对接官方代码的唯一入口，收拢：
 *   - zltSideMenu：官方侧边栏菜单的尾部挂载项（仅 1 项 ZLT 工作区入口）
 *   - zltManagerRoutes：官方主界面路由的尾部挂载项（仅 1 条 /manager/zlt）
 *   - zltSubPages：zlt 工作区内部的子页面注册表（新增子功能只改此数组）
 *
 * 规范依据：.agents/workflows/low_intrusion_standards.md
 *          .agents/specs/overview.md（2.2 工作区架构 / 2.3 子页面总表）
 *
 * 低侵入约束：官方文件仅在 sideMenu / routes 尾部各做一次单行展开挂载；
 * 挂载后永久冻结，后续所有 zlt 子页面扩展都在本注册表与 src/zlt/ 内闭环。
 */

import ZltWorkspace from "./features/zlt_workspace";
import ZltBookManage from "./features/zlt_book_manage";
// zlt 自定义图标样式（如侧边栏的 icon-zlt-z），随注册表被官方 sideMenu 引入时全局生效
import "./zlt_icons.css";

/** 子页面定义：由工作区读取并自动生成 Tab */
export interface ZltSubPage {
  /** 子页面唯一标识（仅工作区内部使用，不进入官方路由） */
  key: string;
  /** Tab 标题（直接中文，zlt UI 免 i18n） */
  title: string;
  /** 子页面组件 */
  component: React.ComponentType<any>;
}

/**
 * 子页面注册表。
 * 维护规则：新增子页面时在此数组追加一项，并在 src/zlt/features/ 下建对应目录，
 * 同步更新 .agents/specs/overview.md 的子页面总表与 features/ 技术规格文档。
 */
export const zltSubPages: ZltSubPage[] = [
  {
    key: "book_manage",
    title: "图书管理",
    component: ZltBookManage,
  },
];

/** 挂载点 A：官方 src/constants/sideMenu.tsx 尾部展开 ...zltSideMenu */
export const zltSideMenu = [
  {
    name: "ZLT",
    // 自定义 Z 字母描边图标，定义于 ./zlt_icons.css（不改官方 icomoon 字体）
    icon: "zlt-z",
    mode: "zlt",
  },
];

/** 挂载点 B：官方 src/router/routes.tsx 尾部展开 ...zltManagerRoutes */
export const zltManagerRoutes = [
  {
    path: "zlt",
    component: ZltWorkspace,
  },
];
