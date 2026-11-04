/**
 * zlt「图书管理」子页面
 *
 * 规格文档：.agents/specs/features/zlt_book_manage.md
 *
 * 仅渲染可复用图书详细信息表格 ZltBookTable；筛选由表格的每列漏斗筛选承担
 * （见 .agents/specs/features/zlt_book_table.md），本页不再提供规则下拉框。
 *
 * zlt UI 免 i18n，文案直接硬编码中文。
 */
import React from "react";
import ZltBookTable from "../../components/zlt_book_table";
import "./zlt_book_manage.css";

const STORAGE_KEY = "book_manage";

const ZltBookManage: React.FC = () => {
  return (
    <div className="zlt-book-manage">
      <ZltBookTable storageKey={STORAGE_KEY} emptyText="暂无图书" />
    </div>
  );
};

export default ZltBookManage;
