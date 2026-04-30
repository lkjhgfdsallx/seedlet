import { stringify } from "./json";

export type TextContent = { type: "text"; text: string };
export type JsonContent = { type: "json"; data: unknown };
export type ImageContent = {
  type: "image";
  data: string; // base64编码
  mimeType?: string;
};
// 参考：https://platform.openai.com/docs/guides/images-vision?api-mode=chat
export type ImageURLContent = {
  type: "image_url";
  image_url: { url: string };
};

export const contentTypes = ["text", "json", "image", "image_url"];

/**
 * 结构化内容表示。
 */
export type Content =
  | TextContent
  | JsonContent
  | ImageContent
  | ImageURLContent;

/* -------------------------------------------------------------------------- */
/* 内容辅助函数                                                                 */
/* -------------------------------------------------------------------------- */

/** 类型守卫：检查内容是否为纯文本。 */
export const isTextContent = (c: Content | null): c is TextContent =>
  !!c && c.type === "text";

/** 便捷辅助函数：文本内容是否包含子字符串？ */
export const textIncludes = (
  c: Content | null,
  substr: string,
  options?: { caseInsensitive?: boolean }
): boolean =>
  isTextContent(c) &&
  (options?.caseInsensitive ? c.text.toLowerCase() : c.text).includes(
    options?.caseInsensitive ? substr.toLowerCase() : substr
  );

/** 便捷辅助函数：创建文本内容对象。 */
export const text = (s: string): TextContent => ({ type: "text", text: s });

/** 检查任意值是否为Content类型。 */
export const isContent = (v: unknown): v is Content =>
  typeof v === "object" &&
  v !== null &&
  "type" in v &&
  // typeof v.type === "string" &&
  // contentTypes.includes(v.type) &&
  ((v.type === "text" && "text" in v && typeof v.text === "string") ||
    (v.type === "json" && "data" in v) ||
    (v.type === "image" && "data" in v && typeof v.data === "string") ||
    (v.type === "image_url" &&
      "image_url" in v &&
      typeof v.image_url === "object" &&
      v.image_url !== null &&
      "url" in v.image_url &&
      typeof v.image_url.url === "string"));

/**
 * 将任意值导出为Content。
 * 如果值已经是Content类型，则返回原始值（甚至不进行浅拷贝）。
 */
export const toContent = <Out>(v: Out): Content =>
  typeof v === "string"
    ? text(v)
    : isContent(v)
      ? v
      : { type: "json", data: v };

// @todo 待扩展
export const toText = (
  content: Content | null | undefined
): string | undefined =>
  content === null || content === undefined
    ? undefined
    : content.type === "text"
      ? content.text
      : content.type === "json"
        ? stringify(content.data)
        : undefined;
