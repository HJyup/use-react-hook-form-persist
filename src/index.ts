import { FieldValues, Path, PathValue, UseFormReturn } from "react-hook-form";
import { useCallback, useEffect, useMemo } from "react";
import { deleteIn, getIn, setIn } from "./internal/deep-copy";

const IS_BROWSER = typeof window !== "undefined";
const INITIAL_VERSION = "1";

type Version = string;

/**
 * Wraps the form data with version information.
 *
 * @template T - The shape of your form values (inferred from react-hook-form).
 */
interface VersionedData<T extends FieldValues> {
  version: Version;
  data: Partial<T>;
}

/**
 * Options for the `useFormPersist` hook.
 *
 * @template T - The shape of your form values (inferred from react-hook-form).
 */
export interface useFormPersistOptions<T extends FieldValues> {
  key: string;
  clearOnSubmit?: boolean;

  /**
   * Fields to exclude from persistence.
   * @example ['password', 'creditCard.number']
   */
  exclude?: Path<T>[];

  /**
   * Fields to include in persistence. If specified, only these fields will be persisted.
   * @example ['email', 'preferences.notifications']
   */
  include?: Path<T>[];

  /**
   * The storage to use. Defaults to localStorage.
   * You can provide your own storage implementation that matches the Storage interface.
   */
  storage?: Storage;

  /**
   * Custom parser for serialization/deserialization.
   * Defaults to JSON.stringify / JSON.parse.
   */
  parser?: {
    serialize: (data: VersionedData<T>) => string;
    deserialize: (data: string) => VersionedData<T>;
  };

  version?: Version;
  onVersionMismatch?: (storedVersion: Version, currentVersion: Version) => void;
}

export const DEFAULT_PARSER = {
  serialize: <T extends FieldValues>(data: VersionedData<T>) =>
    JSON.stringify(data),

  deserialize: <T extends FieldValues>(data: string): VersionedData<T> =>
    JSON.parse(data) as VersionedData<T>
};

/**
 * Add persistence to the form
 *
 * @param options - The options for the persistence
 * @param form - The form to add persistence to
 *
 * @returns The form with persistence
 *
 * @example
 * const form = useForm<FormValues>({
 *   defaultValues: {
 *     name: "John Doe",
 *     email: "john.doe@example.com",
 *   },
 * });
 *
 * const formWithPersistence = useFormPersist(form, {
 *   key: "form-data",
 *   exclude?: ["password"],
 *   include?: ["name", "email"], // if defined, only these values will be saved
 *   clearOnSubmit?: true, // by default true
 * });
 */
export function useFormPersist<T extends FieldValues>(
  form: UseFormReturn<T>,
  options: useFormPersistOptions<T>
) {
  const {
    key,
    clearOnSubmit = true,
    storage = IS_BROWSER ? window.localStorage : undefined,
    parser = DEFAULT_PARSER,
    version = INITIAL_VERSION,
    onVersionMismatch,
    exclude,
    include
  } = options;

  const { serialize, deserialize } = parser;

  const filterData = useCallback(
    <T extends FieldValues>(
      data: Partial<T>,
      include?: Path<T>[],
      exclude?: Path<T>[]
    ): Partial<T> => {
      if (include?.length) {
        const picked = {} as T;
        for (const p of include) {
          const value = getIn(data, p as Path<Partial<T>>);
          if (value !== undefined)
            setIn(picked, p, value as PathValue<T, Path<T>>);
        }
        return picked;
      }
      if (exclude?.length) {
        const pruned = structuredClone(data);
        for (const p of exclude) deleteIn(pruned, p as Path<Partial<T>>);
        return pruned;
      }
      return data;
    },
    [include, exclude]
  );

  const save = useCallback(
    (data: Partial<T>) => {
      try {
        const versionedData: VersionedData<T> = { version, data };
        storage?.setItem(key, serialize(versionedData));
      } catch (err) {
        console.warn("Failed to write", err);
      }
    },
    [key, storage, serialize, version]
  );

  useEffect(() => {
    if (!IS_BROWSER || !storage) return;

    const raw = storage.getItem(key);
    if (!raw) return;

    try {
      const parsed = deserialize(raw);

      if (typeof parsed !== "object" || !("version" in parsed)) {
        storage.removeItem(key);
        return;
      }

      if (parsed.version !== version) {
        console.warn(
          `Version mismatch: stored=${parsed.version}, current=${version}`
        );
        onVersionMismatch?.(parsed.version, version);
        return;
      }

      const values = parsed.data;

      const currentFormData = form.getValues();
      const validFieldNames = new Set(Object.keys(currentFormData));

      for (const [fieldName, fieldValue] of Object.entries(values)) {
        if (!validFieldNames.has(fieldName)) {
          console.warn(`Skipping unknown field: ${fieldName}`);
          continue;
        }
        form.setValue(
          fieldName as Path<T>,
          fieldValue as PathValue<T, Path<T>>,
          {
            shouldDirty: true,
            shouldValidate: false
          }
        );
      }
    } catch (err) {
      console.warn("Failed to parse stored data", err);
      storage.removeItem(key);
    }
  }, []);

  useEffect(() => {
    if (!IS_BROWSER || !storage) return;

    const subscription = form.watch((values) => {
      save(filterData(values as Partial<T>, include, exclude));
    });

    return () => subscription.unsubscribe();
  }, [form, save, storage, include, exclude]);

  const resetPersisted = useCallback(() => {
    storage?.removeItem(key);
  }, [key, storage]);

  const originalHandleSubmit = form.handleSubmit;
  const handleSubmit = useCallback(
    (
      onValid?: Parameters<typeof originalHandleSubmit>[0],
      onInvalid?: Parameters<typeof originalHandleSubmit>[1]
    ) => {
      return originalHandleSubmit((...validArgs) => {
        if (clearOnSubmit) {
          resetPersisted();
        }

        return onValid?.(...validArgs);
      }, onInvalid);
    },
    [originalHandleSubmit, clearOnSubmit, resetPersisted]
  );

  return useMemo(
    () => ({
      ...form,
      handleSubmit,
      resetPersisted
    }),
    [form, handleSubmit, resetPersisted]
  );
}
