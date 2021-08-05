import * as R from 'ramda';

export const EntryKind = {
  Unknown: 'unknown',
  Logger: 'logger',
  Text: 'text',
  Notification: 'notification',
} as const;

export type EntryKind = typeof EntryKind[keyof typeof EntryKind];

export const FieldKey = {
  UnixTime: 'UnixTime',
  Category: 'Category',
  LogLevel: 'LogLevel',
  Item: 'Item',
  Message: 'Message',
  CallerFile: 'CallerFile',
  CallerLine: 'CallerLine',
  CallerMember: 'CallerMember',
} as const;

export type FieldKey = typeof FieldKey[keyof typeof FieldKey];

export const Category = {
  Unknown: '',
  System: 'System',
  SystemStatus: 'SystemStatus',
  Item_New: 'Item_New',
  Item_Destroy: 'Item_Destroy',
  Item_ScriptError: 'Item_ScriptError',
  Item_UnityError: 'Item_UnityError',
  Item_Print: 'Item_Print',
  Item_State: 'Item_State',
  SharedVariable: 'SharedVariable',
} as const;

export type Category = typeof Category[keyof typeof Category];

export const LogLevel = {
  Fatal: 100,
  Error: 200,
  Warning: 300,
  Info: 400,
  Debug: 500,
  Trace: 600,
} as const;

export type LogLevel = typeof LogLevel[keyof typeof LogLevel];

const lowerLogLevelMap: { readonly [key: string]: number | undefined } = {
  fatal: LogLevel.Fatal,
  error: LogLevel.Error,
  warning: LogLevel.Warning,
  warn: LogLevel.Warning,
  info: LogLevel.Info,
  debug: LogLevel.Debug,
  trace: LogLevel.Trace,
};

const reverseLogLevelMap = R.invertObj(LogLevel);

export const logLevelFromLabel = (str: string): number =>
  (str &&
    (lowerLogLevelMap[str.toLowerCase()] ||
      (/^[+-]?\d+$/.test(str) && Number.parseInt(str, 10)))) ||
  Number.NaN;

export const logLevelToLabel = (level: number): string =>
  reverseLogLevelMap[level] ?? String(level | 0);

export const roundLogLevel = (level: number): LogLevel =>
  Number.isFinite(level)
    ? (Math.min(
        Math.max(LogLevel.Fatal, Math.ceil(level / 100) * 100),
        LogLevel.Trace
      ) as LogLevel)
    : LogLevel.Trace;

export type Fields = { [key in FieldKey]?: string } & { [key: string]: string };

type EntryProps = Readonly<{
  kind: EntryKind;
  timestamp: Date;
  logLevel: number;
  category: Category;
  message: string;
  fields: Fields;
}>;

export const EntryMessage = {
  UnsupportedDataFormat: '[Unsupported data format]',
} as const;

export type EntryMessage = typeof EntryMessage[keyof typeof EntryMessage];

const parseUnixTime = (str: string): Date => {
  return new Date(Number.parseInt(str, 10) * 1000);
};

const parseMessageLogLevel = (
  str: string,
  defaultLogLevel = Number.NaN
): [number, string] => {
  const rePiped = /^([a-zA-Z]+)\s?\|\s?/;
  const reBracketed = /^\[([a-zA-Z]+)\]/;

  const m = rePiped.exec(str) ?? reBracketed.exec(str);
  if (m) {
    const messageLevelNumber = logLevelFromLabel(m[1]);
    if (Number.isFinite(messageLevelNumber)) {
      return [messageLevelNumber, str.substring(m[0].length)];
    }
  }
  return [defaultLogLevel, str];
};

const parseMessageField = (str: string): string => {
  const len = str.length;
  return len >= 2 && str.charAt(0) === '"' && str.charAt(len - 1) === '"'
    ? str.substring(1, len - 1)
    : str;
};

export class Entry {
  get kind(): EntryKind {
    return this.props.kind;
  }

  get timestamp(): Date {
    return this.props.timestamp;
  }

  get logLevel(): number {
    return this.props.logLevel;
  }

  get category(): Category {
    return this.props.category;
  }

  get message(): string {
    return this.props.message;
  }

  get fields(): Fields {
    return this.props.fields;
  }

  private constructor(props: EntryProps) {
    this.props = props;
  }

  static make(kind: EntryKind, fields?: Readonly<Fields>): Entry {
    const mFields = Object.assign({}, fields);

    const mUnixTime = mFields.UnixTime;
    const timestamp = mUnixTime
      ? parseUnixTime(mUnixTime)
      : new Date(Number.NaN);

    const category = (mFields.Category as Category) ?? Category.Unknown;

    const mLevelStr = mFields.LogLevel;
    const mLevelNumber = mLevelStr ? logLevelFromLabel(mLevelStr) : Number.NaN;
    const mLogLevel = Number.isFinite(mLevelNumber)
      ? mLevelNumber
      : LogLevel.Debug;

    // ロガータイプで、ログレベルが Debug のときは、メッセージに含まれるログレベルを優先する.
    const mMessage = mFields.Message;
    const [logLevel, message] =
      kind === EntryKind.Logger && mLogLevel === LogLevel.Debug && mMessage
        ? parseMessageLogLevel(mMessage, mLogLevel)
        : [mLogLevel, mMessage ?? ''];
    return new Entry({
      kind: kind,
      timestamp,
      category,
      logLevel,
      message,
      fields: mFields,
    });
  }

  static fromText(kind: EntryKind, logLevel: number, text: string): Entry {
    return Entry.make(kind, {
      LogLevel: logLevelToLabel(logLevel),
      Message: text,
    });
  }

  private static parseFields(fieldsNode: unknown): Entry {
    if (R.is(Object, fieldsNode)) {
      const fields = R.mapObjIndexed(
        (v, k) =>
          k === FieldKey.Message && typeof v === 'string'
            ? parseMessageField(v)
            : String(v),
        fieldsNode as Record<string, unknown>
      );
      return Entry.make(EntryKind.Logger, fields);
    } else {
      return Entry.fromText(
        EntryKind.Notification,
        LogLevel.Error,
        EntryMessage.UnsupportedDataFormat
      );
    }
  }

  static fromStructure(data: unknown): Entry {
    if (Array.isArray(data) && data.length >= 3 && data[1] === 'logger') {
      const nodeList = data[2];
      if (Array.isArray(nodeList) && nodeList.length >= 1) {
        return Entry.parseFields(nodeList[0]);
      }
    }
    return Entry.fromText(
      EntryKind.Notification,
      LogLevel.Error,
      EntryMessage.UnsupportedDataFormat
    );
  }

  private props: EntryProps;
}
