/**
 * zlt 可复用图书详细信息表格：Redux 容器
 *
 * 多选状态、当前书、各官方对话框开关均直接映射官方 Redux 状态：
 *   - isSelectBook / selectedBooks：与官方 SelectBook / AddDialog / DeleteDialog 共享，批量操作零重写；
 *   - isOpen*Dialog：仅用于触发重渲染，使书架 / 书堆等 ConfigService 数据在操作后即时刷新。
 */
import React from "react";
import { connect } from "react-redux";
import {
  handleFetchBooks,
  handleSelectBook,
  handleSelectedBooks,
  handleReadingBook,
  handleActionDialog,
} from "../../../store/actions";
import { stateType } from "../../../store";
import ZltBookTable from "./component";
import { ZltBookTableOwnProps } from "./interface";

const mapStateToProps = (state: stateType) => {
  return {
    books: state.manager.books,
    isSelectBook: state.manager.isSelectBook,
    selectedBooks: state.manager.selectedBooks,
    currentBook: state.book.currentBook,
    isOpenActionDialog: state.book.isOpenActionDialog,
    isOpenAddDialog: state.book.isOpenAddDialog,
    isOpenDeleteDialog: state.book.isOpenDeleteDialog,
    isOpenEditDialog: state.book.isOpenEditDialog,
    isOpenAddCollectionDialog: state.collection.isOpenAddCollectionDialog,
  };
};

const actionCreator = {
  handleFetchBooks,
  handleSelectBook,
  handleSelectedBooks,
  handleReadingBook,
  handleActionDialog,
};

export default connect(
  mapStateToProps,
  actionCreator
)(ZltBookTable as any) as unknown as React.ComponentType<ZltBookTableOwnProps>;
