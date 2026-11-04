/**
 * zlt 图书表格：列筛选纯逻辑
 *
 * 规格文档：.agents/specs/features/zlt_book_table.md
 *
 * 本文件为纯函数集合（无 React、无副作用，ConfigService 读写除外），便于单测。
 * 所有「已生效 / 有效条件」判据的唯一来源：算子定义表 OPERATORS + compileCondition。
 * 不变量：compileCondition / compileColumnFilter 只依据条件自身，不读取当前数据的枚举可选值集合。
 */
import { ConfigService } from "../../../assets/lib/kookit-extra-browser.min";
import {
  ZltBookRow,
  ZltColumnDef,
  ZltColumnFilter,
  ZltColumnFilterMap,
  ZltFilterCondition,
  ZltFilterOperator,
  ZltFilterType,
} from "./interface";

/** 算子元数据：UI 下拉选项与运行期校验的唯一来源 */
export const OPERATORS: Record<
  ZltFilterType,
  { value: ZltFilterOperator; label: string }[]
> = {
  text: [
    { value: "contains", label: "包含" },
    { value: "notContains", label: "不包含" },
    { value: "startsWith", label: "开头是" },
    { value: "endsWith", label: "结尾是" },
    { value: "eq", label: "等于" },
    { value: "ne", label: "不等于" },
  ],
  number: [
    { value: "gt", label: "大于" },
    { value: "gte", label: "大于等于" },
    { value: "eq", label: "等于" },
    { value: "lt", label: "小于" },
    { value: "lte", label: "小于等于" },
    { value: "between", label: "介于" },
  ],
  enum: [
    { value: "anyOf", label: "属于其中之一" },
    { value: "noneOf", label: "不属于" },
    { value: "isEmpty", label: "为空" },
    { value: "isNotEmpty", label: "不为空" },
  ],
};

/** between 需要两个输入框（下限 + 上限） */
export const isRangeOperator = (op: ZltFilterOperator): boolean =>
  op === "between";
/** isEmpty / isNotEmpty 无输入框 */
export const isValuelessOperator = (op: ZltFilterOperator): boolean =>
  op === "isEmpty" || op === "isNotEmpty";
/** anyOf / noneOf 为多选 */
export const isMultiOperator = (op: ZltFilterOperator): boolean =>
  op === "anyOf" || op === "noneOf";

/** 某算子是否属于该类型的合法算子集合 */
const isOperatorOfType = (
  filterType: ZltFilterType,
  op: ZltFilterOperator
): boolean => OPERATORS[filterType].some((item) => item.value === op);

/**
 * 列取值解析：按 columnId 直接从原始字段取值，不复用含排序兜底（\uffff / shelves[0]）的 sortValue。
 * 0 为真实数值（未读 / 无大小），直接参与比较，不做跳过或豁免。
 */
export const getFilterValue = (
  row: ZltBookRow,
  columnId: string
): string | number | string[] => {
  switch (columnId) {
    case "name":
      return row.name;
    case "author":
      return row.author;
    case "format":
      return row.format;
    case "publisher":
      return row.publisher;
    case "progress":
      return row.percentage;
    case "size":
      return row.size;
    case "shelves":
      return row.shelves;
    case "collection":
      return row.collection;
    default:
      return "";
  }
};

/** 收集 enum 列的可选值：shelves 展平去重升序、collection 非空去重升序 */
export const collectEnumValues = (
  rows: ZltBookRow[],
  columnId: string
): string[] => {
  const set = new Set<string>();
  if (columnId === "shelves") {
    rows.forEach((row) => {
      row.shelves.forEach((title) => {
        if (title) set.add(title);
      });
    });
  } else if (columnId === "collection") {
    rows.forEach((row) => {
      if (row.collection) set.add(row.collection);
    });
  }
  return Array.from(set).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
  );
};

/**
 * 单位换算：浮层输入单位 → 底层比较数值。
 * progress 按百分比 0~100 输入，除以 100 得 0~1；size 按 MB 输入，乘 1024*1024 得字节。
 * 其余数值列原样。换算只在把输入字符串解析为比较数值时做，存储仍是用户所见单位的原始字符串。
 */
const parseNumberInput = (columnId: string, raw?: string): number => {
  const parsed = parseFloat(raw ?? "");
  if (isNaN(parsed)) return NaN;
  if (columnId === "progress") return parsed / 100;
  if (columnId === "size") return parsed * 1024 * 1024;
  return parsed;
};

/**
 * 把单条条件编译为谓词；无效条件（空 / NaN / lo>hi / 空多选）返回 null，由上层跳过。
 */
export const compileCondition = (
  columnId: string,
  filterType: ZltFilterType,
  condition: ZltFilterCondition
): ((row: ZltBookRow) => boolean) | null => {
  const { operator } = condition;
  if (!isOperatorOfType(filterType, operator)) return null;

  if (filterType === "text") {
    const needle = (condition.value ?? "").toLowerCase();
    if (needle === "") return null;
    return (row) => {
      const target = String(getFilterValue(row, columnId)).toLowerCase();
      switch (operator) {
        case "contains":
          return target.indexOf(needle) > -1;
        case "notContains":
          return target.indexOf(needle) === -1;
        case "startsWith":
          return target.startsWith(needle);
        case "endsWith":
          return target.endsWith(needle);
        case "eq":
          return target === needle;
        case "ne":
          return target !== needle;
        default:
          return false;
      }
    };
  }

  if (filterType === "number") {
    if (operator === "between") {
      const lo = parseNumberInput(columnId, condition.value);
      const hi = parseNumberInput(columnId, condition.value2);
      if (isNaN(lo) || isNaN(hi)) return null;
      if (lo > hi) return null;
      return (row) => {
        const x = Number(getFilterValue(row, columnId));
        return x >= lo && x <= hi;
      };
    }
    const bound = parseNumberInput(columnId, condition.value);
    if (isNaN(bound)) return null;
    return (row) => {
      const x = Number(getFilterValue(row, columnId));
      switch (operator) {
        case "gt":
          return x > bound;
        case "gte":
          return x >= bound;
        case "eq":
          return x === bound;
        case "lt":
          return x < bound;
        case "lte":
          return x <= bound;
        default:
          return false;
      }
    };
  }

  // enum
  if (operator === "isEmpty" || operator === "isNotEmpty") {
    return (row) => {
      const v = getFilterValue(row, columnId);
      const empty = Array.isArray(v) ? v.length === 0 : v === "";
      return operator === "isEmpty" ? empty : !empty;
    };
  }
  // anyOf / noneOf
  const values = condition.values;
  if (!Array.isArray(values) || values.length === 0) return null;
  const valueSet = new Set(values);
  return (row) => {
    const v = getFilterValue(row, columnId);
    let hit: boolean;
    if (Array.isArray(v)) {
      hit = v.some((item) => valueSet.has(item));
    } else {
      hit = valueSet.has(v as string);
    }
    return operator === "anyOf" ? hit : !hit;
  };
};

/** 整列编译：条件按 conjunction 用 every/some 组合；无有效条件返回 null */
export const compileColumnFilter = (
  columnId: string,
  filterType: ZltFilterType,
  columnFilter: ZltColumnFilter | undefined
): ((row: ZltBookRow) => boolean) | null => {
  if (!columnFilter || !Array.isArray(columnFilter.conditions)) return null;
  const preds = columnFilter.conditions
    .map((condition) => compileCondition(columnId, filterType, condition))
    .filter(
      (pred): pred is (row: ZltBookRow) => boolean => pred !== null
    );
  if (preds.length === 0) return null;
  if (columnFilter.conjunction === "or") {
    return (row) => preds.some((pred) => pred(row));
  }
  return (row) => preds.every((pred) => pred(row));
};

/** 全量编译：对每个有 filterType 的列编译，收集非 null 谓词（跨列由调用方 AND 串联） */
export const compileFilters = (
  filterMap: ZltColumnFilterMap,
  columns: ZltColumnDef[]
): ((row: ZltBookRow) => boolean)[] => {
  const result: ((row: ZltBookRow) => boolean)[] = [];
  columns.forEach((column) => {
    if (!column.filterType) return;
    const pred = compileColumnFilter(
      column.id,
      column.filterType,
      filterMap[column.id]
    );
    if (pred) result.push(pred);
  });
  return result;
};

/* ---------- 持久化 ---------- */

export const columnFilterStorageKey = (storageKey: string): string =>
  "zlt_colfilter_" + storageKey;

export const saveColumnFilters = (
  storageKey: string,
  filterMap: ZltColumnFilterMap
): void => {
  const key = columnFilterStorageKey(storageKey);
  if (!filterMap || Object.keys(filterMap).length === 0) {
    ConfigService.removeItem(key);
  } else {
    ConfigService.setItem(key, JSON.stringify(filterMap));
  }
};

/**
 * 清洗单条条件：与运行期 compileCondition 的有效性判定一致（含 lo>hi 判无效）。
 * 返回清洗后的条件；非法则返回 null。
 */
const sanitizeCondition = (
  columnId: string,
  filterType: ZltFilterType,
  raw: unknown
): ZltFilterCondition | null => {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as {
    operator?: unknown;
    value?: unknown;
    value2?: unknown;
    values?: unknown;
  };
  const operator = candidate.operator;
  if (typeof operator !== "string") return null;
  if (!isOperatorOfType(filterType, operator as ZltFilterOperator)) return null;

  const condition: ZltFilterCondition = {
    operator: operator as ZltFilterOperator,
  };
  if (typeof candidate.value === "string") condition.value = candidate.value;
  if (typeof candidate.value2 === "string") condition.value2 = candidate.value2;
  if (Array.isArray(candidate.values)) {
    condition.values = candidate.values.filter(
      (item): item is string => typeof item === "string"
    );
  }
  // 复用运行期口径：能编译为非 null 谓词才算有效条件
  return compileCondition(columnId, filterType, condition)
    ? condition
    : null;
};

/**
 * 读取持久化的列筛选；顶层 try-catch 整体回退 {}，逐列逐条清洗非法项。
 */
export const loadColumnFilters = (
  storageKey: string,
  columns: ZltColumnDef[]
): ZltColumnFilterMap => {
  try {
    const raw = ConfigService.getItem(columnFilterStorageKey(storageKey));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const result: ZltColumnFilterMap = {};
    Object.keys(parsed).forEach((columnId) => {
      const column = columns.find((c) => c.id === columnId);
      if (!column || !column.filterType) return;
      const value = (parsed as Record<string, unknown>)[columnId];
      if (!value || typeof value !== "object") return;
      const columnFilter = value as {
        conjunction?: unknown;
        conditions?: unknown;
      };
      if (
        columnFilter.conjunction !== "and" &&
        columnFilter.conjunction !== "or"
      ) {
        return;
      }
      if (!Array.isArray(columnFilter.conditions)) return;
      const conditions = columnFilter.conditions
        .map((condition) =>
          sanitizeCondition(columnId, column.filterType as ZltFilterType, condition)
        )
        .filter((c): c is ZltFilterCondition => c !== null);
      if (conditions.length === 0) return;
      result[columnId] = {
        conjunction: columnFilter.conjunction,
        conditions,
      };
    });
    return result;
  } catch (e) {
    // JSON 损坏整体回退为空
    return {};
  }
};
