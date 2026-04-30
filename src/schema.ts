export type JSONSchemaType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "array"
  | "object";

export type JSONSchemaObject = {
  type: "object";
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
};

export type JSONSchemaArray = {
  type: "array";
  items: JSONSchemaProperty;
};

export type JSONSchemaPrimitive = {
  type: Exclude<JSONSchemaType, "object" | "array">;
  description?: string;
  enum?: string[]; // 假设枚举仅用于字符串类型
  default?: unknown;
  minimum?: number;
  maximum?: number;
};

export type JSONSchemaProperty =
  | JSONSchemaPrimitive
  | JSONSchemaObject
  | JSONSchemaArray;

/**
 * 用于描述类型 T 的顶层模式。
 */
export type TypedSchema<T extends Record<string, unknown>> =
  JSONSchemaObject & {
    properties: Record<keyof T & string, JSONSchemaProperty>;
    __type?: T;
  };

export const typedSchema = <T extends Record<string, unknown>>(
  schema: JSONSchemaObject & {
    properties: Record<keyof T & string, JSONSchemaProperty>;
  }
): TypedSchema<T> => schema as TypedSchema<T>;

const isPlainObject = (val: unknown): val is Record<string, unknown> =>
  typeof val === "object" && val !== null && !Array.isArray(val);

const coerceType = (value: unknown, type: JSONSchemaType): unknown => {
  if (value === undefined || value === null) {
    return value;
  }
  switch (type) {
    case "string":
      return String(value);
    case "number":
      return typeof value === "string" ? Number(value) : value;
    case "integer":
      return typeof value === "string" ? Number.parseInt(value, 10) : value;
    case "boolean":
      if (value === "true") return true;
      if (value === "false") return false;
      return value;
    case "array":
    case "object":
      // 我们不在此处直接强制转换这些类型，将在下面递归处理
      return value;
  }
};

const validateType = (value: unknown, schema: JSONSchemaProperty): boolean => {
  if (value === undefined || value === null) {
    return true; // 默认允许 undefined/null
  }
  switch (schema.type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && !Number.isNaN(value);
    case "integer":
      return Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "array": {
      if (!Array.isArray(value)) return false;
      const arrSchema = schema as JSONSchemaArray;
      return value.every((v) => validateType(v, arrSchema.items));
    }
    case "object": {
      if (!isPlainObject(value)) return false;
      const objSchema = schema as JSONSchemaObject;
      return Object.entries(objSchema.properties).every(([k, prop]) =>
        validateType(value[k], prop)
      );
    }
  }
};

const validateEnum = (value: unknown, schema: JSONSchemaProperty): boolean => {
  // 只有基本类型可能有枚举（假设为基于字符串的枚举）。
  if ("enum" in schema && schema.enum) {
    return schema.enum.includes(value as string);
  }
  return true;
};

const applyDefault = (value: unknown, schema: JSONSchemaProperty): unknown =>
  value === undefined && "default" in schema ? schema.default : value;

/**
 * applySchema 递归地将模式应用于提供的参数：
 * - 强制执行必需属性
 * - 应用默认值
 * - 强制类型转换
 * - 验证类型和枚举成员资格
 */
export const applySchema = <T extends Record<string, unknown>>(
  schema: TypedSchema<T>,
  args: Partial<T>
): T => {
  const result: Record<string, unknown> = {};

  for (const [key, propSchema] of Object.entries(schema.properties)) {
    const input = args[key];
    let value = applyDefault(input, propSchema);

    if (value === undefined && schema.required?.includes(key)) {
      throw new Error(`Missing required property '${key}'`);
    }

    // 如果属性模式是对象，则递归处理
    if (value !== undefined && propSchema.type === "object") {
      value = applySchema(
        propSchema as TypedSchema<Record<string, unknown>>,
        value as Record<string, unknown>
      );
    }

    // 如果属性模式是数组，则递归处理
    if (value !== undefined && propSchema.type === "array") {
      const arrSchema = propSchema as JSONSchemaArray;
      value = (value as unknown[]).map((item) => {
        if (arrSchema.items.type === "object") {
          return applySchema(
            arrSchema.items as TypedSchema<Record<string, unknown>>,
            item as Record<string, unknown>
          );
        }
        // 如果不是对象，暂时直接返回该项
        return item;
      });
    }

    // 将值强制转换为预期类型
    value = coerceType(value, propSchema.type);

    // 验证结果值
    if (!validateType(value, propSchema)) {
      throw new Error(`Invalid type for property '${key}'`);
    }
    if (!validateEnum(value, propSchema)) {
      const enumValues = (propSchema as JSONSchemaPrimitive).enum;
      throw new Error(
        `Invalid value for property '${key}': must be one of ${JSON.stringify(enumValues)}`
      );
    }

    result[key] = value;
  }

  return result as T;
};
