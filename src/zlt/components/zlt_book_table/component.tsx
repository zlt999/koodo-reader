/**
 * zlt 可复用图书详细信息表格
 *
 * 规格文档：.agents/specs/features/zlt_book_table.md
 *
 * 能力：
 *   - 每本书一行（书堆不折叠），列可在「列设置」中勾选显示/隐藏，点击表头排序；
 *   - 单击行切换勾选（未进入多选时自动进入），Shift+单击连选，表头复选框全选/半选；
 *   - 多选状态直接写入官方 Redux（isSelectBook / selectedBooks），底部渲染官方 <SelectBook /> 批量操作栏；
 *   - 右键行或点击行尾「⋯」弹出官方 <ActionDialog />；二级对话框由官方 Manager 页统一渲染；
 *   - 书架 / 书堆 / 进度来自 ConfigService，在相关官方对话框开关时随重渲染即时重算。
 *
 * 持久化（仅桌面端 UI 状态，不涉及安卓端业务数据）：
 *   - zlt_columns_<storageKey>：显示的可选列 id 数组
 *   - zlt_sort_<storageKey>：排序状态 { columnId, order }
 *
 * zlt UI 免 i18n，文案直接硬编码中文。
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import BookModel from "../../../models/Book";
import ActionDialog from "../../../components/dialogs/actionDialog";
import SelectBook from "../../../components/selectBook";
import {
  ConfigService,
  CollectionUtil,
} from "../../../assets/lib/kookit-extra-browser.min";
import DatabaseService from "../../../utils/storage/databaseService";
import {
  clampMenuPosition,
  estimateMenuHeight,
  CONTEXT_MENU_WIDTH,
  getFileNameWithoutExtension,
} from "../../../utils/common";
import {
  ZltBookRow,
  ZltBookTableProps,
  ZltColumnFilter,
  ZltColumnFilterMap,
  ZltSortState,
} from "./interface";
import {
  zltColumns,
  zltOptionalColumns,
  zltDefaultVisibleColumnIds,
} from "./columns";
import {
  collectEnumValues,
  compileColumnFilter,
  compileFilters,
  loadColumnFilters,
  saveColumnFilters,
} from "./filterLogic";
import ZltColumnFilterPopup from "./columnFilter";
import "./zlt_book_table.css";

/** 浮层宽度常量，与 .zlt-book-table-filter-popup 的 min-width 对齐，供 clampMenuPosition 做右缘收敛 */
const FILTER_POPUP_WIDTH = 260;

/** 粗估浮层高度（仅为 clampMenuPosition 越界收敛，不要求精确） */
const estimateFilterPopupHeight = (filter?: ZltColumnFilter): number => {
  const conditionCount = filter?.conditions?.length ?? 1;
  return 90 + Math.max(conditionCount, 1) * 44;
};

const collectionUtil = new CollectionUtil(ConfigService);

const columnsStorageKey = (key: string) => "zlt_columns_" + key;
const sortStorageKey = (key: string) => "zlt_sort_" + key;

const loadVisibleColumns = (storageKey: string): string[] => {
  try {
    const saved = ConfigService.getItem(columnsStorageKey(storageKey));
    if (saved) {
      const ids = JSON.parse(saved);
      if (Array.isArray(ids)) {
        return ids.filter((id) => zltOptionalColumns.some((c) => c.id === id));
      }
    }
  } catch (e) {
    // 配置损坏时回退默认
  }
  return [...zltDefaultVisibleColumnIds];
};

const loadSort = (storageKey: string): ZltSortState | null => {
  try {
    const saved = ConfigService.getItem(sortStorageKey(storageKey));
    if (saved) {
      const sort = JSON.parse(saved);
      if (
        sort &&
        zltColumns.some((c) => c.id === sort.columnId && c.sortValue) &&
        (sort.order === "asc" || sort.order === "desc")
      ) {
        return sort;
      }
    }
  } catch (e) {
    // 配置损坏时回退不排序
  }
  return null;
};

const compareValue = (a: string | number, b: string | number): number => {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
};

/**
 * 从官方 books 表读取完整书籍记录，并保持 keys 原有顺序。
 *
 * [zlt] 不使用 DatabaseService.getRecordsByKeys("books")：官方 getByKeysStatement
 * 为 books 表生成的 SQL 形如
 *   SELECT * FROM books WHERE key IN (?...) ORDER BY CASE key WHEN ? THEN n ... END
 * 需要 keys 的两倍参数，但 main.js 的 database-command handler 只传一份 data，
 * 故一次性批量查询必然抛 "Too few parameter values"（官方该版本既有缺陷）。
 * 改用无占位符、稳定可靠的 getAllRecords("books")，在渲染侧按 key 建索引并保序。
 */
const fetchBookRecords = async (keys: string[]): Promise<BookModel[]> => {
  if (keys.length === 0) return [];
  const allRecords: BookModel[] = await DatabaseService.getAllRecords("books");
  const recordMap: Record<string, BookModel> = {};
  (allRecords || []).forEach((record: BookModel) => {
    if (record && record.key) recordMap[record.key] = record;
  });
  return keys.map((key) => recordMap[key]).filter(Boolean);
};

/** 由书籍记录与 ConfigService 中的书架 / 书堆 / 进度组装表格行 */
const buildRows = (records: BookModel[]): ZltBookRow[] => {
  // 书架：shelfTitle → bookKey[]，反转为 bookKey → shelfTitle[]
  const shelfMap = ConfigService.getAllMapConfig("shelfList") || {};
  const bookShelves: Record<string, string[]> = {};
  Object.keys(shelfMap).forEach((title) => {
    (shelfMap[title] || []).forEach((bookKey: string) => {
      if (!bookShelves[bookKey]) bookShelves[bookKey] = [];
      bookShelves[bookKey].push(title);
    });
  });

  // 书堆：一本书最多属于一个有效书堆
  const bookCollection: Record<string, string> = {};
  (collectionUtil.getCollectionList() || []).forEach((collection: any) => {
    if (!collection || collectionUtil.isCollectionDeleted(collection.key)) {
      return;
    }
    (collection.books || []).forEach((bookKey: string) => {
      if (!bookCollection[bookKey]) bookCollection[bookKey] = collection.name;
    });
  });

  const locations = ConfigService.getAllObjectConfig("recordLocation") || {};
  const isUseOriginalName =
    ConfigService.getReaderConfig("isUseOriginalName") === "yes";

  return records.map((book) => {
    const percentage = parseFloat(locations[book.key]?.percentage);
    return {
      key: book.key,
      book,
      name: isUseOriginalName
        ? getFileNameWithoutExtension(book.path, book.name)
        : book.name,
      author: book.author || "",
      format: book.format || "",
      publisher: book.publisher || "",
      size: book.size || 0,
      shelves: bookShelves[book.key] || [],
      collection: bookCollection[book.key] || "",
      percentage: isNaN(percentage) ? 0 : percentage,
    };
  });
};

const ZltBookTable: React.FC<ZltBookTableProps> = (props) => {
  const {
    storageKey,
    filter,
    filterKey,
    toolbarLeft,
    emptyText,
    books,
    isSelectBook,
    selectedBooks,
    currentBook,
    isOpenActionDialog,
    isOpenEditDialog,
    handleFetchBooks,
    handleSelectBook,
    handleSelectedBooks,
    handleReadingBook,
    handleActionDialog,
  } = props;

  const [records, setRecords] = useState<BookModel[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [visibleIds, setVisibleIds] = useState<string[]>(() =>
    loadVisibleColumns(storageKey)
  );
  const [sort, setSort] = useState<ZltSortState | null>(() =>
    loadSort(storageKey)
  );
  const [isShowColumnMenu, setIsShowColumnMenu] = useState(false);
  const [menuBookKey, setMenuBookKey] = useState("");
  const [menuPos, setMenuPos] = useState({ left: 0, top: 0 });
  const [columnFilters, setColumnFilters] = useState<ZltColumnFilterMap>(() =>
    loadColumnFilters(storageKey, zltColumns)
  );
  const [openFilterColumnId, setOpenFilterColumnId] = useState("");
  const [filterPopupPos, setFilterPopupPos] = useState({ left: 0, top: 0 });

  /** Shift 连选锚点：上一次单击的行序号 */
  const anchorIndexRef = useRef(-1);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const columnFilterRef = useRef<HTMLDivElement>(null);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  const prevEditDialogRef = useRef(isOpenEditDialog);
  const isFirstFilterRef = useRef(true);

  // 进入页面时刷新官方书库 key 列表；离开时退出多选并清空已选，避免选择状态带到其它页面
  useEffect(() => {
    handleFetchBooks();
    return () => {
      handleSelectBook(false);
      handleSelectedBooks([]);
    };
  }, []);

  // 编辑对话框关闭（书名 / 作者可能已修改）后重新读取书籍记录
  useEffect(() => {
    if (prevEditDialogRef.current && !isOpenEditDialog) {
      setReloadToken((token) => token + 1);
    }
    prevEditDialogRef.current = isOpenEditDialog;
  }, [isOpenEditDialog]);

  // 书库变化时重新读取完整记录（collection key 跳过，书堆内的书本身就在书库中）
  useEffect(() => {
    let cancelled = false;
    const keys = (books || [])
      .map((item) => item.key)
      .filter((key) => key && !collectionUtil.isCollection(key));
    fetchBookRecords(keys).then((result) => {
      if (!cancelled) {
        setRecords(result);
        setIsLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [books, reloadToken]);

  // 切换筛选规则时清空已选
  useEffect(() => {
    if (isFirstFilterRef.current) {
      isFirstFilterRef.current = false;
      return;
    }
    anchorIndexRef.current = -1;
    handleSelectedBooks([]);
  }, [filterKey]);

  // 点击列设置面板外部时关闭
  useEffect(() => {
    if (!isShowColumnMenu) return;
    const handleMouseDown = (event: MouseEvent) => {
      if (
        columnMenuRef.current &&
        !columnMenuRef.current.contains(event.target as Node)
      ) {
        setIsShowColumnMenu(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isShowColumnMenu]);

  // 点击列头筛选浮层外部时关闭（与列设置面板同构）
  useEffect(() => {
    if (!openFilterColumnId) return;
    const handleMouseDown = (event: MouseEvent) => {
      if (
        columnFilterRef.current &&
        !columnFilterRef.current.contains(event.target as Node)
      ) {
        setOpenFilterColumnId("");
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [openFilterColumnId]);

  // 书架 / 书堆 / 进度存于 ConfigService（非 Redux），每次重渲染时重算；
  // 官方对话框开关、多选变化都会触发重渲染，从而在操作后即时刷新。
  const allRows = buildRows(records);

  // 列筛选谓词只依赖 columnFilters（本地 state，引用稳定），缓存避免每渲染重复编译算子。
  const columnPredicates = useMemo(
    () => compileFilters(columnFilters, zltColumns),
    [columnFilters]
  );

  // enum 可选值每渲染从当前 allRows 收集（O(n)、不缓存），与 allRows 即时反映 ConfigService 对齐。
  const enumValuesMap = {
    shelves: collectEnumValues(allRows, "shelves"),
    collection: collectEnumValues(allRows, "collection"),
  };

  let filteredRows = filter ? allRows.filter(filter) : allRows;
  if (columnPredicates.length > 0) {
    filteredRows = filteredRows.filter((row) =>
      columnPredicates.every((pred) => pred(row))
    );
  }

  const visibleColumns = zltColumns.filter(
    (c) => c.fixed || visibleIds.indexOf(c.id) > -1
  );
  const sortColumn =
    sort && visibleColumns.find((c) => c.id === sort.columnId && c.sortValue);
  let rows = filteredRows;
  if (sort && sortColumn && sortColumn.sortValue) {
    const getValue = sortColumn.sortValue;
    const direction = sort.order === "asc" ? 1 : -1;
    rows = filteredRows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const result = compareValue(getValue(a.row), getValue(b.row));
        return result !== 0 ? result * direction : a.index - b.index;
      })
      .map((item) => item.row);
  }

  const selectedSet = new Set(selectedBooks);
  const selectedVisibleCount = rows.filter((row) =>
    selectedSet.has(row.key)
  ).length;
  const isAllSelected = rows.length > 0 && selectedVisibleCount === rows.length;
  const isPartSelected = selectedVisibleCount > 0 && !isAllSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isPartSelected;
    }
  }, [isPartSelected]);

  const persistVisibleIds = (ids: string[]) => {
    setVisibleIds(ids);
    ConfigService.setItem(columnsStorageKey(storageKey), JSON.stringify(ids));
  };

  // 列筛选写入：落盘 + 清空已选（走与 filterKey 相同的路径），满足筛选变化清空选择
  const applyColumnFilters = (next: ZltColumnFilterMap) => {
    setColumnFilters(next);
    saveColumnFilters(storageKey, next);
    anchorIndexRef.current = -1;
    handleSelectedBooks([]);
  };

  const updateColumnFilter = (columnId: string, next: ZltColumnFilter) => {
    applyColumnFilters({ ...columnFilters, [columnId]: next });
  };

  const clearColumnFilter = (columnId: string) => {
    const next = { ...columnFilters };
    delete next[columnId];
    applyColumnFilters(next);
  };

  const clearAllColumnFilters = () => {
    applyColumnFilters({});
  };

  // 已生效判据：与 chip、实际过滤同源（compileColumnFilter 返回非 null）
  const isColumnFilterActive = (columnId: string): boolean => {
    const column = zltColumns.find((c) => c.id === columnId);
    if (!column || !column.filterType) return false;
    return (
      compileColumnFilter(
        columnId,
        column.filterType,
        columnFilters[columnId]
      ) !== null
    );
  };

  const openFilterPopup = (event: React.MouseEvent, columnId: string) => {
    event.stopPropagation(); // 关键：不冒泡到 <th onClick> 触发排序
    if (openFilterColumnId === columnId) {
      setOpenFilterColumnId("");
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const pos = clampMenuPosition(
      rect.left,
      rect.bottom + 4,
      FILTER_POPUP_WIDTH,
      estimateFilterPopupHeight(columnFilters[columnId])
    );
    setFilterPopupPos(pos);
    setOpenFilterColumnId(columnId);
  };

  // 生效筛选的列（chip 来源）；只依赖 columnFilters（compileColumnFilter 不读 enumValues）
  const activeFilterColumns = useMemo(
    () =>
      zltColumns.filter(
        (c) =>
          c.filterType &&
          compileColumnFilter(c.id, c.filterType, columnFilters[c.id]) !== null
      ),
    [columnFilters]
  );

  const openFilterColumn = openFilterColumnId
    ? zltColumns.find((c) => c.id === openFilterColumnId)
    : undefined;

  const toggleColumn = (id: string) => {
    const ids =
      visibleIds.indexOf(id) > -1
        ? visibleIds.filter((item) => item !== id)
        : zltOptionalColumns
            .map((c) => c.id)
            .filter((item) => item === id || visibleIds.indexOf(item) > -1);
    persistVisibleIds(ids);
  };

  const resetColumns = () => {
    persistVisibleIds([...zltDefaultVisibleColumnIds]);
  };

  // 表头排序：升序 → 降序 → 不排序 循环
  const handleSort = (columnId: string) => {
    let next: ZltSortState | null;
    if (!sort || sort.columnId !== columnId) {
      next = { columnId, order: "asc" };
    } else if (sort.order === "asc") {
      next = { columnId, order: "desc" };
    } else {
      next = null;
    }
    setSort(next);
    if (next) {
      ConfigService.setItem(sortStorageKey(storageKey), JSON.stringify(next));
    } else {
      ConfigService.removeItem(sortStorageKey(storageKey));
    }
  };

  const handleHeaderCheck = () => {
    if (!isSelectBook) handleSelectBook(true);
    if (isAllSelected) {
      const visibleKeys = new Set(rows.map((row) => row.key));
      handleSelectedBooks(selectedBooks.filter((key) => !visibleKeys.has(key)));
    } else {
      handleSelectedBooks(
        Array.from(new Set([...selectedBooks, ...rows.map((row) => row.key)]))
      );
    }
    anchorIndexRef.current = -1;
  };

  // 单击行：切换勾选；Shift+单击：从锚点连选（逻辑参考官方 useBookItem.handleShiftSelect）
  const handleRowClick = (event: React.MouseEvent, index: number) => {
    const key = rows[index].key;
    if (!isSelectBook) {
      handleSelectBook(true);
      handleSelectedBooks([key]);
      anchorIndexRef.current = index;
      return;
    }
    const anchor = anchorIndexRef.current;
    if (event.shiftKey && anchor >= 0 && anchor < rows.length) {
      const start = Math.min(anchor, index);
      const end = Math.max(anchor, index);
      const rangeKeys = rows.slice(start, end + 1).map((row) => row.key);
      handleSelectedBooks(Array.from(new Set([...selectedBooks, ...rangeKeys])));
      return;
    }
    handleSelectedBooks(
      selectedSet.has(key)
        ? selectedBooks.filter((item) => item !== key)
        : [...selectedBooks, key]
    );
    anchorIndexRef.current = index;
  };

  // [zlt-copy] 源自官方 src/components/bookListItem/component.tsx -> handleMoreAction()（基线 fbc7deda）
  // [zlt-mod] 改为由表格行 / 行尾「⋯」触发，并记录当前弹出菜单对应的书
  const openActionMenu = (event: React.MouseEvent, row: ZltBookRow) => {
    event.preventDefault();
    event.stopPropagation();
    let x = event.clientX;
    if (x > document.body.clientWidth - 300) {
      x = x - 180;
    }
    const pos = clampMenuPosition(
      x,
      document.body.clientHeight - event.clientY > 250
        ? event.clientY
        : event.clientY - 200,
      CONTEXT_MENU_WIDTH,
      estimateMenuHeight(10)
    );
    setMenuPos(pos);
    setMenuBookKey(row.key);
    handleReadingBook(row.book);
    handleActionDialog(true);
  };

  const renderSortMark = (columnId: string) => {
    if (!sort || sort.columnId !== columnId) return null;
    return (
      <span className="zlt-book-table-sort-mark">
        {sort.order === "asc" ? "▲" : "▼"}
      </span>
    );
  };

  const renderColumnMenu = () => (
    <div className="zlt-book-table-column-setting" ref={columnMenuRef}>
      <span
        className="zlt-book-table-button"
        onClick={() => setIsShowColumnMenu(!isShowColumnMenu)}
      >
        列设置
      </span>
      {isShowColumnMenu && (
        <div className="zlt-book-table-column-menu">
          {zltOptionalColumns.map((column) => (
            <label className="zlt-book-table-column-option" key={column.id}>
              <input
                type="checkbox"
                checked={visibleIds.indexOf(column.id) > -1}
                onChange={() => toggleColumn(column.id)}
              />
              <span>{column.title}</span>
            </label>
          ))}
          <div className="zlt-book-table-column-reset" onClick={resetColumns}>
            恢复默认
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="zlt-book-table">
      <div className="zlt-book-table-toolbar">
        <div className="zlt-book-table-toolbar-left">
          {toolbarLeft}
          {activeFilterColumns.length > 0 && (
            <span className="zlt-book-table-chips">
              {activeFilterColumns.map((column) => (
                <span className="zlt-book-table-chip" key={column.id}>
                  {column.title}
                  <span
                    className="zlt-book-table-chip-remove"
                    title="清除本列筛选"
                    onClick={() => clearColumnFilter(column.id)}
                  >
                    ✕
                  </span>
                </span>
              ))}
              <span
                className="zlt-book-table-chip-clear-all"
                onClick={clearAllColumnFilters}
              >
                清除全部筛选
              </span>
            </span>
          )}
          <span className="zlt-book-table-count">
            共 {rows.length} 本
            {isSelectBook ? `，已选 ${selectedBooks.length} 本` : ""}
          </span>
        </div>
        {renderColumnMenu()}
      </div>

      <div className="zlt-book-table-scroll">
        {isLoaded && rows.length === 0 ? (
          <div className="zlt-book-table-empty">
            {emptyText || "暂无图书"}
          </div>
        ) : (
          <table className="zlt-book-table-table">
            <thead>
              <tr>
                <th className="zlt-book-table-check-cell">
                  <input
                    type="checkbox"
                    ref={headerCheckboxRef}
                    checked={isAllSelected}
                    onChange={handleHeaderCheck}
                    title={isAllSelected ? "全不选" : "全选"}
                  />
                </th>
                {visibleColumns.map((column) => (
                  <th
                    key={column.id}
                    style={column.width ? { width: column.width } : {}}
                    className={
                      column.sortValue ? "zlt-book-table-sortable" : ""
                    }
                    onClick={() => column.sortValue && handleSort(column.id)}
                  >
                    {column.title}
                    {renderSortMark(column.id)}
                    {column.filterType && (
                      <span
                        className={
                          isColumnFilterActive(column.id)
                            ? "zlt-book-table-funnel active"
                            : "zlt-book-table-funnel"
                        }
                        title="筛选"
                        onClick={(event) => openFilterPopup(event, column.id)}
                      >
                        <svg
                          viewBox="0 0 16 16"
                          width="12"
                          height="12"
                          fill="currentColor"
                        >
                          <path d="M1.5 2h13l-5 6v4.5l-3 1.5V8z" />
                        </svg>
                      </span>
                    )}
                  </th>
                ))}
                <th className="zlt-book-table-more-cell"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const isSelected = selectedSet.has(row.key);
                return (
                  <tr
                    key={row.key}
                    className={
                      isSelected
                        ? "zlt-book-table-row zlt-book-table-row-selected"
                        : "zlt-book-table-row"
                    }
                    onClick={(event) => handleRowClick(event, index)}
                    onContextMenu={(event) => openActionMenu(event, row)}
                  >
                    <td className="zlt-book-table-check-cell">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        tabIndex={-1}
                      />
                    </td>
                    {visibleColumns.map((column) => (
                      <td
                        key={column.id}
                        className={
                          column.id === "name" ? "zlt-book-table-name" : ""
                        }
                        title={
                          column.id === "shelves"
                            ? row.shelves.join("、")
                            : undefined
                        }
                      >
                        {column.render(row)}
                      </td>
                    ))}
                    <td className="zlt-book-table-more-cell">
                      <span
                        className="zlt-book-table-more"
                        title="操作"
                        onClick={(event) => openActionMenu(event, row)}
                      >
                        ⋯
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {isSelectBook && (
        <div className="zlt-book-table-footer">
          <SelectBook />
        </div>
      )}

      {isOpenActionDialog &&
      menuBookKey &&
      currentBook &&
      currentBook.key === menuBookKey ? (
        <div className="zlt-book-table-action-parent">
          <ActionDialog {...({ left: menuPos.left, top: menuPos.top } as any)} />
        </div>
      ) : null}

      {openFilterColumnId && openFilterColumn && openFilterColumn.filterType ? (
        <div
          className="zlt-book-table-filter-popup"
          ref={columnFilterRef}
          style={{ left: filterPopupPos.left, top: filterPopupPos.top }}
          onClick={(event) => event.stopPropagation()}
        >
          <ZltColumnFilterPopup
            column={openFilterColumn}
            filter={columnFilters[openFilterColumnId]}
            enumValues={
              openFilterColumnId === "shelves"
                ? enumValuesMap.shelves
                : openFilterColumnId === "collection"
                ? enumValuesMap.collection
                : []
            }
            onChange={(next) => updateColumnFilter(openFilterColumnId, next)}
            onClear={() => {
              clearColumnFilter(openFilterColumnId);
              setOpenFilterColumnId("");
            }}
            onClose={() => setOpenFilterColumnId("")}
          />
        </div>
      ) : null}
    </div>
  );
};

export default ZltBookTable;
