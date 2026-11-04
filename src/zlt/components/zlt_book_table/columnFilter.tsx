/**
 * zlt 图书表格：列头漏斗筛选浮层（受控无状态展示组件）
 *
 * 规格文档：.agents/specs/features/zlt_book_table.md
 *
 * 职责单一：渲染某列的筛选浮层内容，所有编辑即时构造新的 ZltColumnFilter 经 onChange 上报。
 * 浮层屏幕定位（fixed）与「点击外部关闭」「容器 stopPropagation」由 component.tsx 统一管理，
 * 本组件内部不缓存草稿、不自行向上转发 / 重建点击事件。
 */
import React from "react";
import {
  ZltColumnDef,
  ZltColumnFilter,
  ZltFilterCondition,
  ZltFilterOperator,
  ZltFilterType,
} from "./interface";
import {
  OPERATORS,
  isMultiOperator,
  isRangeOperator,
  isValuelessOperator,
} from "./filterLogic";

interface ZltColumnFilterPopupProps {
  column: ZltColumnDef;
  filter: ZltColumnFilter | undefined;
  enumValues: string[];
  onChange: (next: ZltColumnFilter) => void;
  onClear: () => void;
  onClose: () => void;
}

/** 数值列单位后缀：progress → %，size → MB，其余无 */
const unitOf = (columnId: string): string => {
  if (columnId === "progress") return "%";
  if (columnId === "size") return "MB";
  return "";
};

const ZltColumnFilterPopup: React.FC<ZltColumnFilterPopupProps> = (props) => {
  const { column, filter, enumValues, onChange, onClear, onClose } = props;
  const filterType = column.filterType as ZltFilterType;
  const operators = OPERATORS[filterType];
  const conjunction = filter?.conjunction ?? "and";
  const conditions: ZltFilterCondition[] = filter?.conditions ?? [];

  /** 以当前算子集首项为默认算子构造一条空条件 */
  const defaultCondition = (): ZltFilterCondition => ({
    operator: operators[0].value,
  });

  const emit = (
    nextConditions: ZltFilterCondition[],
    nextConjunction: "and" | "or" = conjunction
  ) => {
    onChange({ conjunction: nextConjunction, conditions: nextConditions });
  };

  const updateCondition = (index: number, patch: Partial<ZltFilterCondition>) => {
    const next = conditions.map((condition, i) =>
      i === index ? { ...condition, ...patch } : condition
    );
    emit(next);
  };

  const changeOperator = (index: number, operator: ZltFilterOperator) => {
    // 切换算子时清掉与新算子语义不符的旧输入，避免残留
    const next = conditions.map((condition, i) =>
      i === index ? { operator } : condition
    );
    emit(next);
  };

  const addCondition = () => {
    emit([...conditions, defaultCondition()]);
  };

  const removeCondition = (index: number) => {
    emit(conditions.filter((_, i) => i !== index));
  };

  const toggleEnumValue = (index: number, value: string) => {
    const current = conditions[index].values ?? [];
    const nextValues = current.indexOf(value) > -1
      ? current.filter((item) => item !== value)
      : [...current, value];
    updateCondition(index, { values: nextValues });
  };

  const renderInputs = (condition: ZltFilterCondition, index: number) => {
    const op = condition.operator;
    if (isValuelessOperator(op)) return null;

    if (filterType === "text") {
      return (
        <input
          type="text"
          value={condition.value ?? ""}
          onChange={(e) => updateCondition(index, { value: e.target.value })}
        />
      );
    }

    if (filterType === "number") {
      const unit = unitOf(column.id);
      if (isRangeOperator(op)) {
        return (
          <>
            <input
              type="number"
              value={condition.value ?? ""}
              onChange={(e) =>
                updateCondition(index, { value: e.target.value })
              }
            />
            <span className="zlt-book-table-filter-unit">~</span>
            <input
              type="number"
              value={condition.value2 ?? ""}
              onChange={(e) =>
                updateCondition(index, { value2: e.target.value })
              }
            />
            {unit && (
              <span className="zlt-book-table-filter-unit">{unit}</span>
            )}
          </>
        );
      }
      return (
        <>
          <input
            type="number"
            value={condition.value ?? ""}
            onChange={(e) => updateCondition(index, { value: e.target.value })}
          />
          {unit && <span className="zlt-book-table-filter-unit">{unit}</span>}
        </>
      );
    }

    // enum anyOf / noneOf
    if (isMultiOperator(op)) {
      const selected = condition.values ?? [];
      return (
        <div className="zlt-book-table-filter-enum">
          {enumValues.length === 0 ? (
            <span className="zlt-book-table-filter-unit">无可选值</span>
          ) : (
            enumValues.map((value) => (
              <label
                className="zlt-book-table-filter-enum-item"
                key={value}
                title={value}
              >
                <input
                  type="checkbox"
                  checked={selected.indexOf(value) > -1}
                  onChange={() => toggleEnumValue(index, value)}
                />
                <span>{value}</span>
              </label>
            ))
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="zlt-book-table-filter-content">
      <div className="zlt-book-table-filter-title">
        <span>{column.title}</span>
        {conditions.length >= 2 && (
          <span className="zlt-book-table-filter-conj">
            <span
              className={conjunction === "and" ? "active" : ""}
              onClick={() => emit(conditions, "and")}
            >
              与
            </span>
            <span
              className={conjunction === "or" ? "active" : ""}
              onClick={() => emit(conditions, "or")}
            >
              或
            </span>
          </span>
        )}
      </div>

      {conditions.length === 0 ? (
        <div className="zlt-book-table-filter-hint">暂无筛选条件</div>
      ) : (
        conditions.map((condition, index) => (
          <div className="zlt-book-table-filter-row" key={index}>
            <select
              value={condition.operator}
              onChange={(e) =>
                changeOperator(index, e.target.value as ZltFilterOperator)
              }
            >
              {operators.map((item) => (
                <option value={item.value} key={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            {renderInputs(condition, index)}
            <span
              className="zlt-book-table-filter-remove"
              title="删除条件"
              onClick={() => removeCondition(index)}
            >
              ✕
            </span>
          </div>
        ))
      )}

      <div className="zlt-book-table-filter-actions">
        <span
          className="zlt-book-table-filter-add"
          onClick={addCondition}
        >
          添加条件
        </span>
        <span className="zlt-book-table-filter-clear" onClick={onClear}>
          清除本列
        </span>
        <span className="zlt-book-table-filter-done" onClick={onClose}>
          完成
        </span>
      </div>
    </div>
  );
};

export default ZltColumnFilterPopup;
