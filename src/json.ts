/**
 * JSON 字符串化器的自定义规则。
 */
export interface CustomRule<T> {
  test: (v: unknown) => v is T;
  output: (v: T) => unknown;
}

/**
 * 类似于 `JSON.stringify`，但支持 bigint，省略不可序列化的值，
 * 检测循环引用，使用 2 空格缩进进行美化打印，并按字母顺序
 * 对对象键进行排序，使输出具有确定性。
 */
export const stringify = (
  value: unknown,
  options?: { noFail?: boolean; customRules?: CustomRule<unknown>[] }
): string => {
  const seen = new Set<object>();
  const indentUnit = "  "; // 2 个空格

  const serialize = (val: unknown, level: number): string => {
    if (val === null) return "null";

    const type = typeof val;

    if (type === "number" || type === "boolean") return String(val);
    if (type === "string") return JSON.stringify(val);
    if (type === "bigint") return `"${val?.toString()}"`;
    if (type === "function" || type === "symbol" || type === "undefined") {
      return undefined as never;
    }

    if (Array.isArray(val)) {
      if (val.length === 0) return "[]";
      const nextLevel = level + 1;
      const items = val.map((el) => {
        const out = serialize(el, nextLevel);
        return `${indentUnit.repeat(nextLevel)}${out ?? "null"}`;
      });
      return `[\n${items.join(",\n")}\n${indentUnit.repeat(level)}]`;
    }

    if (type === "object") {
      for (const rule of options?.customRules || [])
        if (rule.test(val)) return serialize(rule.output(val), level);
      if (seen.has(val as object)) {
        if (options?.noFail) return serialize(undefined, level);
        throw new TypeError("Converting circular structure to JSON");
      }
      seen.add(val as object);

      const keys = Object.keys(val as object).sort();
      const entries: string[] = [];

      for (const k of keys) {
        const v = (val as Record<string, unknown>)[k];
        const out = serialize(v, level + 1);
        if (out === undefined) continue;
        entries.push(
          `${indentUnit.repeat(level + 1)}${JSON.stringify(k)}: ${out}`
        );
      }

      seen.delete(val as object);

      if (entries.length === 0) return "{}";
      return `{\n${entries.join(",\n")}\n${indentUnit.repeat(level)}}`;
    }

    return undefined as never;
  };

  return serialize(value, 0);
};
