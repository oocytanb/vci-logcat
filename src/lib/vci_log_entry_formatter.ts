import * as R from 'ramda';
import moment from 'moment';
import chalk from 'chalk';

import {
  Entry,
  FieldKey,
  LogLevel,
  logLevelToLabel,
  roundLogLevel,
} from './vci_log_entry';

export * from './vci_log_entry';

const formatTimestamp = (timestamp: Date): string => {
  return Number.isFinite(timestamp.getTime())
    ? moment(timestamp).format('HH:mm:ss')
    : '--:--:--';
};

const immediateFieldMap: Readonly<
  Partial<Record<FieldKey, (entry: Entry) => string>>
> = {
  LogLevel: (entry) => logLevelToLabel(entry.logLevel),
  Message: (entry) => entry.message,
  Category: (entry) => entry.category,
  UnixTime: (entry) => formatTimestamp(entry.timestamp),
};

export function fieldText(
  entry: Entry,
  fieldKey: FieldKey | string
): string | undefined;

export function fieldText(
  entry: Entry,
  fieldKey: FieldKey | string,
  defaultValue: string
): string;

export function fieldText(
  entry: Entry,
  fieldKey: FieldKey | string,
  defaultValue?: string
): string | undefined {
  if (fieldKey == FieldKey.LogLevel) {
    // ログレベルの場合は、ラベルを返す。
    return logLevelToLabel(entry.logLevel);
  } else {
    // フィールドが値を持っていれば、immediateFieldMap を優先して値を返す。
    // そうでなければ、defaultValue を返す。
    const val = entry.fields[fieldKey];
    return val === undefined
      ? defaultValue
      : immediateFieldMap[fieldKey as FieldKey]?.(entry) ?? val;
  }
}

export const defaultFieldList: Array<FieldKey> = [
  FieldKey.UnixTime,
  FieldKey.LogLevel,
  FieldKey.Category,
  FieldKey.Item,
  FieldKey.Message,
];

export type FieldCallback<TResult> = (
  prev: TResult,
  curr: string | undefined,
  key: string,
  entry: Entry
) => TResult;

export const reduceFields = <TResult>(
  entry: Entry,
  callback: FieldCallback<TResult>,
  accumulator: TResult
): TResult => {
  return R.reduce(
    (prev, key) => {
      if (typeof key === 'string') {
        return callback(prev, fieldText(entry, key), key, entry);
      } else {
        throw new TypeError(`Invalid key: ${key}`);
      }
    },
    accumulator,
    R.keys(entry.fields)
  );
};

export const reduceSpecifiedFields = <TResult>(
  entry: Entry,
  keys: FieldKey[],
  callback: FieldCallback<TResult>,
  accumulator: TResult
): TResult => {
  return R.reduce(
    (prev, fieldKey) => {
      const text = fieldText(entry, fieldKey);
      return text === undefined ? prev : callback(prev, text, fieldKey, entry);
    },
    accumulator,
    keys
  );
};

export type EntryTextFormatter = (entry: Entry) => string;

type FieldTextFormatter = (
  value: string | undefined,
  key: string,
  entry: Entry
) => string | undefined;

const plainFieldTextFormatter = (
  value: string | undefined,
  _key: string,
  _entry: Entry
): string | undefined => value;

const consoleStylerMap: Readonly<
  Partial<Record<LogLevel, (value: string) => string>>
> = {
  [LogLevel.Fatal]: chalk.whiteBright.bgRed,
  [LogLevel.Error]: chalk.whiteBright.bgRed,
  [LogLevel.Warning]: chalk.black.bgYellowBright,
  [LogLevel.Info]: chalk.black.bgGreenBright,
};

const consoleStyledFieldTextFormatter = (
  value: string | undefined,
  key: string,
  entry: Entry
): string | undefined => {
  if (value !== undefined && key == FieldKey.LogLevel) {
    const styler = consoleStylerMap[roundLogLevel(entry.logLevel)];
    return styler ? styler(value) : value;
  } else {
    return value;
  }
};

const accumulateFieldText = (prev: string, text: string | undefined) =>
  text === undefined ? prev : prev ? prev + ' | ' + text : text;

const makeFullTextFormatter =
  (fieldFormatter: FieldTextFormatter) => (entry: Entry) =>
    reduceFields(
      entry,
      (prev, curr, key, entry) => {
        const s = key + ' = ' + (fieldFormatter(curr, key, entry) ?? '');
        return accumulateFieldText(prev, s);
      },
      ''
    );

const makeSpecifiedTextFormatter =
  (fieldFormatter: FieldTextFormatter, keys: FieldKey[]) => (entry: Entry) =>
    reduceSpecifiedFields(
      entry,
      keys,
      (prev, curr, key, entry) => {
        return accumulateFieldText(prev, fieldFormatter(curr, key, entry));
      },
      ''
    );

export const fullTextFormatter = makeFullTextFormatter(plainFieldTextFormatter);

export const consoleStyledFullTextFormatter = makeFullTextFormatter(
  consoleStyledFieldTextFormatter
);

export const defaultTextFormatter = makeSpecifiedTextFormatter(
  plainFieldTextFormatter,
  defaultFieldList
);

export const consoleStyledDefaultTextFormatter = makeSpecifiedTextFormatter(
  consoleStyledFieldTextFormatter,
  defaultFieldList
);

export const jsonRecordFormatter = (entry: Entry): string =>
  JSON.stringify(entry.fields);
