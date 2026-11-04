/**
 * zlt 工作区 Redux 容器
 *
 * 仅映射侧边栏折叠状态 isCollapsed，用于让工作区左边缘随侧边栏折叠/展开对齐官方首页。
 * 子页面各自按需 connect，工作区不承载其它全局状态。
 */
import { connect } from "react-redux";
import { stateType } from "../../../store";
import ZltWorkspace from "./component";

const mapStateToProps = (state: stateType) => {
  return {
    isCollapsed: state.sidebar.isCollapsed,
  };
};

export default connect(mapStateToProps)(ZltWorkspace);
