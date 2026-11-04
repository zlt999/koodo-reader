/**
 * zlt 可复用图书详细信息表格：类型定义
 *
 * 规格文档：.agents/specs/features/zlt_book_table.md
 */
import React from "react";
import BookModel from "../../../models/Book";

/** 表格中的一行（每本书一行，书堆不折叠） */
export interface ZltBookRow {
  key: string;
  book: BookModel;
  /** 显示用书名（遵循官方 isUseOriginalName 设置） */
  name: string;
  author: string;
  format: string;
  publisher: string;
  /** 文件大小（字节） */
  size: number;
  /** 所在书架名列表（按官方 shelfList 顺序） */
  shelves: string[];
  /** 所在书堆名；不在任何书堆为空字符串 */
  collection: string;
  /** 阅读进度 0~1 */
  percentage: number;
}

/** 列可筛选的内容类型；列未声明 filterType 则不可筛选、不渲染漏斗 */
export type ZltFilterType = "text" | "number" | "enum";

/** 文本算子 */
export type ZltTextOperator =
  | "contains"
  | "notContains"
  | "startsWith"
  | "endsWith"
  | "eq"
  | "ne";
/** 数值算子 */
export type ZltNumberOperator =
  | "gt"
  | "gte"
  | "eq"
  | "lt"
  | "lte"
  | "between";
/** 枚举算子 */
export type ZltEnumOperator = "anyOf" | "noneOf" | "isEmpty" | "isNotEmpty";

export type ZltFilterOperator =
  | ZltTextOperator
  | ZltNumberOperator
  | ZltEnumOperator;

/** 单条筛选条件（不同算子只用到其中的部分字段） */
export interface ZltFilterCondition {
  operator: ZltFilterOperator;
  /** text：匹配文本；number：主输入值（between 为下限），一律以字符串存储 */
  value?: string;
  /** number 的 between 上限 */
  value2?: string;
  /** enum 的 anyOf / noneOf 选中的多值 */
  values?: string[];
}

/** 一列的筛选状态 */
export interface ZltColumnFilter {
  conjunction: "and" | "or";
  conditions: ZltFilterCondition[];
}

/** 全部列筛选状态：columnId → 该列筛选 */
export type ZltColumnFilterMap = Record<string, ZltColumnFilter>;

/** 列定义 */
export interface ZltColumnDef {
  id: string;
  title: string;
  /** 固定列：始终显示，不出现在列设置中 */
  fixed?: boolean;
  /** 可选列的默认显示状态 */
  defaultVisible?: boolean;
  /** 排序取值；返回 string 按文本排序，number 按数值排序。缺省则该列不可排序 */
  sortValue?: (row: ZltBookRow) => string | number;
  /** 单元格渲染 */
  render: (row: ZltBookRow) => React.ReactNode;
  /** 列宽（CSS 值），缺省自适应 */
  width?: string;
  /** 列可筛选的内容类型；缺省则不可筛选、列头不渲染漏斗 */
  filterType?: ZltFilterType;
  /** 参与筛选取值；缺省时由 filterLogic.getFilterValue 按 columnId 取值（内置列不需声明） */
  filterValue?: (row: ZltBookRow) => string | number | string[];
}

export type ZltSortOrder = "asc" | "desc";

export interface ZltSortState {
  columnId: string;
  order: ZltSortOrder;
}

/** 使用方（各 Tab 子页面）传入的 props */
export interface ZltBookTableOwnProps {
  /** 持久化命名空间：列设置存 zlt_columns_<storageKey>，排序存 zlt_sort_<storageKey> */
  storageKey: string;
  /** 行过滤规则；缺省显示全部 */
  filter?: (row: ZltBookRow) => boolean;
  /** 过滤规则标识；变化时清空已选 */
  filterKey?: string;
  /** 工具栏左侧插槽（如规则筛选下拉框） */
  toolbarLeft?: React.ReactNode;
  /** 空态文案 */
  emptyText?: string;
}

/** Redux 映射的 props */
export interface ZltBookTableStateProps {
  books: BookModel[];
  isSelectBook: boolean;
  selectedBooks: string[];
  currentBook: BookModel;
  isOpenActionDialog: boolean;
  isOpenAddDialog: boolean;
  isOpenDeleteDialog: boolean;
  isOpenEditDialog: boolean;
  isOpenAddCollectionDialog: boolean;
}

export interface ZltBookTableDispatchProps {
  handleFetchBooks: () => void;
  handleSelectBook: (isSelectBook: boolean) => void;
  handleSelectedBooks: (selectedBooks: string[]) => void;
  handleReadingBook: (book: BookModel) => void;
  handleActionDialog: (isShow: boolean) => void;
}

export type ZltBookTableProps = ZltBookTableOwnProps &
  ZltBookTableStateProps &
  ZltBookTableDispatchProps;
