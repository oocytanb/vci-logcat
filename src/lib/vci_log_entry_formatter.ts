import * as R from 'ramda';
import chalk from 'chalk';

import {
  Entry,
  FieldKey,
  LogLevel,
  roundLogLevel,
  fieldText,
} from './vci_log_entry';

export * from './vci_log_entry';

export const defaultFieldList: ReadonlyArray<FieldKey> = [
  FieldKey.UnixTime,
  FieldKey.LogLevel,
  FieldKey.Category,
  FieldKey.Item,
  FieldKey.Message,
];

export type EntryTextFormatter = (entry: Entry) => string;

export type FieldCollector<TResult> = (
  prev: TResult,
  curr: string | undefined,
  key: string,
  entry: Entry
) => TResult;

export const fieldReducer =
  <TResult>(collector: FieldCollector<TResult>, entry: Entry) =>
  (prev: TResult, key: string): TResult => {
    const text = fieldText(key, entry);
    return text === undefined ? prev : collector(prev, text, key, entry);
  };

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
  if (value !== undefined && key === FieldKey.LogLevel) {
    const styler = consoleStylerMap[roundLogLevel(entry.logLevel)];
    return styler ? styler(value) : value;
  } else {
    return value;
  }
};

const accumulateFieldText = (prev: string, text: string | undefined) =>
  text === undefined ? prev : prev ? prev + ' | ' + text : text;

const makeTextFormatter =
  (fieldFormatter: FieldTextFormatter, keys: ReadonlyArray<FieldKey>) =>
  (entry: Entry) =>
    R.reduce(
      fieldReducer(
        (prev, curr, key, entry) =>
          accumulateFieldText(prev, fieldFormatter(curr, key, entry)),
        entry
      ),
      '',
      keys
    );

const makeFullTextFormatter =
  (fieldFormatter: FieldTextFormatter) => (entry: Entry) =>
    R.reduce(
      fieldReducer(
        (prev, curr, key, entry) =>
          accumulateFieldText(
            prev,
            key + ' = ' + (fieldFormatter(curr, key, entry) ?? '')
          ),
        entry
      ),
      '',
      R.keys<Record<string, string>>(entry.fields)
    );

export const defaultTextFormatter = makeTextFormatter(
  plainFieldTextFormatter,
  defaultFieldList
);

export const consoleStyledDefaultTextFormatter = makeTextFormatter(
  consoleStyledFieldTextFormatter,
  defaultFieldList
);

export const fullTextFormatter = makeFullTextFormatter(plainFieldTextFormatter);

export const consoleStyledFullTextFormatter = makeFullTextFormatter(
  consoleStyledFieldTextFormatter
);

export const jsonRecordFormatter = (entry: Entry): string =>
  JSON.stringify(entry.fields);
