/**
 * zlt 图书表格：列定义
 *
 * 固定列：书名（复选框列与行尾「⋯」列由表格本体渲染，不在此处定义）。
 * 可选列：作者 / 格式 / 所在书架 / 进度（默认显示），出版社 / 文件大小 / 所在书堆（默认隐藏）。
 * 新增列只需在 zltColumns 追加一项。
 */
import React from "react";
import { ZltColumnDef } from "./interface";

const EMPTY = "—";

/** 字节数格式化为 KB / MB / GB */
export const formatSize = (size: number): string => {
  if (!size || size <= 0) return EMPTY;
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value = value / 1024;
    index++;
  }
  return (index === 0 ? value.toString() : value.toFixed(1)) + " " + units[index];
};

/** 进度显示：0 → 未读，1 → 读完，其余为百分比（规则对齐官方 BookListItem） */
export const formatPercentage = (percentage: number): string => {
  if (!percentage || percentage <= 0) return "未读";
  if (percentage >= 1) return "读完";
  return (percentage * 100).toFixed(1) + "%";
};

export const zltColumns: ZltColumnDef[] = [
  {
    id: "name",
    title: "书名",
    fixed: true,
    sortValue: (row) => row.name,
    filterType: "text",
    render: (row) => row.name || EMPTY,
  },
  {
    id: "author",
    title: "作者",
    defaultVisible: true,
    width: "14%",
    sortValue: (row) => row.author,
    filterType: "text",
    render: (row) => row.author || EMPTY,
  },
  {
    id: "format",
    title: "格式",
    defaultVisible: true,
    width: "72px",
    sortValue: (row) => row.format,
    filterType: "text",
    render: (row) => row.format || EMPTY,
  },
  {
    id: "shelves",
    title: "所在书架",
    defaultVisible: true,
    width: "22%",
    // 按第一个书架名排序；未放入书架的排在最后（以私用区字符兜底）
    sortValue: (row) => (row.shelves.length > 0 ? row.shelves[0] : "\uffff"),
    // [zlt] enum 筛选取值走 filterLogic.getFilterValue(row.shelves)，不走上方 sortValue
    //       （sortValue 的 "\uffff"/shelves[0] 仅为排序兜底，会污染筛选语义）
    filterType: "enum",
    render: (row) =>
      row.shelves.length > 0 ? (
        <span className="zlt-book-table-tags">
          {row.shelves.map((title) => (
            <span className="zlt-book-table-tag" key={title} title={title}>
              {title}
            </span>
          ))}
        </span>
      ) : (
        <span className="zlt-book-table-weak">未放入书架</span>
      ),
  },
  {
    id: "progress",
    title: "进度",
    defaultVisible: true,
    width: "72px",
    sortValue: (row) => row.percentage,
    filterType: "number",
    render: (row) => formatPercentage(row.percentage),
  },
  {
    id: "publisher",
    title: "出版社",
    defaultVisible: false,
    width: "14%",
    sortValue: (row) => row.publisher,
    filterType: "text",
    render: (row) => row.publisher || EMPTY,
  },
  {
    id: "size",
    title: "文件大小",
    defaultVisible: false,
    width: "88px",
    sortValue: (row) => row.size || 0,
    filterType: "number",
    render: (row) => formatSize(row.size),
  },
  {
    id: "collection",
    title: "所在书堆",
    defaultVisible: false,
    width: "14%",
    sortValue: (row) => row.collection || "\uffff",
    // [zlt] enum 筛选取值走 filterLogic.getFilterValue(row.collection)，不走上方 sortValue
    //       （sortValue 的 "\uffff" 仅为排序兜底，会污染筛选语义）
    filterType: "enum",
    render: (row) =>
      row.collection ? (
        row.collection
      ) : (
        <span className="zlt-book-table-weak">{EMPTY}</span>
      ),
  },
];

/** 可选列（出现在列设置中） */
export const zltOptionalColumns = zltColumns.filter((c) => !c.fixed);

/** 默认显示的可选列 id */
export const zltDefaultVisibleColumnIds = zltOptionalColumns
  .filter((c) => c.defaultVisible)
  .map((c) => c.id);
