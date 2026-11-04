/**
 * zlt 工作区容器组件
 *
 * 职责：作为侧边栏「ZLT」入口（/manager/zlt）对应的唯一主界面工作区。
 * 顶部渲染一排水平 Tab（由 zltSubPages 注册表驱动），Tab 下方条件渲染当前激活子页面。
 *
 * 扩展方式：新增子功能时只需在 src/zlt/zlt_registry.ts 的 zltSubPages 追加一项，
 * 本组件自动生成对应 Tab，无需改动本文件，也无需触碰任何官方文件。
 *
 * 说明：zlt UI 免 i18n，文案直接硬编码中文。
 */

import React, { useState } from "react";
import { ConfigService } from "../../../assets/lib/kookit-extra-browser.min";
import { zltSubPages } from "../../zlt_registry";
import "./zlt_workspace.css";

const ACTIVE_TAB_KEY = "zlt_activeSubPage";

interface ZltWorkspaceProps {
  /** 官方侧边栏是否折叠（state.sidebar.isCollapsed） */
  isCollapsed: boolean;
}

// [zlt-copy] 源自官方 src/containers/lists/bookList/component.tsx -> render() 中
// .book-list-container-parent 的折叠内联样式（基线 5e929750）：
// 侧边栏折叠时内容区左移到 70px，与官方首页左边缘保持一致。
const collapsedStyle: React.CSSProperties = {
  width: "calc(100vw - 70px)",
  left: "70px",
};

const ZltWorkspace: React.FC<ZltWorkspaceProps> = ({ isCollapsed }) => {
  // 默认激活上次选中的子页面；无记录则取注册表第一项
  const getInitialKey = (): string => {
    const saved = ConfigService.getItem(ACTIVE_TAB_KEY);
    if (saved && zltSubPages.some((p) => p.key === saved)) {
      return saved;
    }
    return zltSubPages.length > 0 ? zltSubPages[0].key : "";
  };

  const [activeKey, setActiveKey] = useState<string>(getInitialKey);

  const handleSwitch = (key: string) => {
    setActiveKey(key);
    ConfigService.setItem(ACTIVE_TAB_KEY, key);
  };

  const activePage = zltSubPages.find((p) => p.key === activeKey);
  const ActiveComponent = activePage ? activePage.component : null;

  return (
    <div
      className="zlt-workspace"
      style={isCollapsed ? collapsedStyle : {}}
    >
      <div className="zlt-workspace-tabbar">
        {zltSubPages.map((page) => (
          <div
            key={page.key}
            className={
              page.key === activeKey
                ? "zlt-workspace-tab zlt-workspace-tab-active"
                : "zlt-workspace-tab"
            }
            onClick={() => handleSwitch(page.key)}
          >
            {page.title}
          </div>
        ))}
      </div>
      <div className="zlt-workspace-body">
        {ActiveComponent ? (
          <ActiveComponent />
        ) : (
          <div className="zlt-workspace-empty">暂无可显示的子页面</div>
        )}
      </div>
    </div>
  );
};

export default ZltWorkspace;
