import { zltSideMenu } from "../zlt/zlt_registry";

export const sideMenu = [
  {
    name: "Books",
    icon: "home-line",
    mode: "home",
  },
  {
    name: "Favorites",
    icon: "heart",
    mode: "favorite",
  },

  {
    name: "Notes",
    icon: "idea-line",
    mode: "note",
  },
  {
    name: "Highlights",
    icon: "highlight-line",
    mode: "highlight",
  },
  {
    name: "Deleted Books",
    icon: "trash-line",
    mode: "trash",
  },
  ...zltSideMenu, // [zlt] 挂载点 A：zlt 工作区侧边栏入口（单行尾挂载）
];
