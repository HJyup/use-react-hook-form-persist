import { FieldValues, Path, PathValue } from "react-hook-form";

const splitPath = (p: string) => p.split(".");
const isIndex = (s: string) => String(+s) === s;

/**
 * Get a nested value by path
 */
export function getIn<T extends FieldValues, P extends Path<T>>(
  obj: T,
  path: P
): PathValue<T, P> | undefined {
  const segments = splitPath(path);
  let current = obj;

  for (const segment of segments) {
    if (current == null) return undefined;
    current = isIndex(segment) ? current?.[+segment] : current?.[segment];
  }

  return current as PathValue<T, P> | undefined;
}

/**
 * Set a nested value by path
 */
export function setIn<T extends FieldValues, P extends Path<T>>(
  target: T,
  path: P,
  value: PathValue<T, P>
): T {
  const segments = splitPath(path);
  let current: unknown = target;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];

    if (i === segments.length - 1) {
      if (isIndex(segment)) {
        if (!Array.isArray(current)) current = [] as unknown[];
        (current as unknown[])[+segment] = value as unknown;
      } else {
        (current as Record<string, unknown>)[segment] = value as unknown;
      }
    } else {
      if (isIndex(segment)) {
        if (!Array.isArray(current))
          throw new Error("setIn: expected array container");

        const arr = current as unknown[];
        if (!arr[+segment]) arr[+segment] = isIndex(segments[i + 1]) ? [] : {};

        current = arr[+segment];
      } else {
        const obj = current as Record<string, unknown>;
        if (!obj[segment]) obj[segment] = isIndex(segments[i + 1]) ? [] : {};

        current = obj[segment];
      }
    }
  }
  return target;
}

/**
 * Delete a nested value by path
 */
export function deleteIn<T extends FieldValues, P extends Path<T>>(
  obj: T,
  path: P
): boolean {
  const segments = splitPath(path);

  function deleteNode(node: unknown, i: number): boolean {
    if (node == null) return true;

    const segment = segments[i];
    if (i === segments.length - 1) {
      if (isIndex(segment) && Array.isArray(node)) {
        delete (node as unknown[])[+segment];
      } else {
        if (typeof node === "object" && node !== null) {
          delete (node as Record<string, unknown>)[segment];
        }
      }
    } else {
      const next = isIndex(segment)
        ? Array.isArray(node)
          ? (node as unknown[])[+segment]
          : undefined
        : typeof node === "object" && node !== null
        ? (node as Record<string, unknown>)[segment]
        : undefined;
      const empty = deleteNode(next, i + 1);

      if (empty) {
        if (isIndex(segment) && Array.isArray(node)) {
          const child = (node as unknown[])[+segment];
          if (
            child &&
            typeof child === "object" &&
            !Array.isArray(child) &&
            Object.keys(child as Record<string, unknown>).length === 0
          )
            delete (node as unknown[])[+segment];
        } else if (typeof node === "object" && node !== null) {
          const objNode = node as Record<string, unknown>;
          const child = objNode[segment];
          if (
            child &&
            typeof child === "object" &&
            !Array.isArray(child) &&
            Object.keys(child as Record<string, unknown>).length === 0
          ) {
            delete objNode[segment];
          }
        }
      }
    }

    if (Array.isArray(node)) return false;
    if (node && typeof node === "object")
      return Object.keys(node as Record<string, unknown>).length === 0;

    return false;
  }
  return deleteNode(obj, 0);
}
