import * as R from 'ramda';
import moment from 'moment';

export type VciIdMap = Map<string, string>;

export const leadingVciId = (vciId: string): string => {
  const s = vciId.replace(/-/g, '');
  return s.length <= 7 ? s : s.substring(0, 7);
};

export const simplifyVciId = (
  vciId: string,
  idMap: VciIdMap,
): [string, VciIdMap] => {
  const shortId = leadingVciId(vciId);
  const prev = idMap.get(shortId);
  if (prev === undefined) {
    const d = new Map(idMap);
    d.set(shortId, vciId);
    return [shortId, d];
  } else {
    return [prev === vciId ? shortId : vciId, idMap];
  }
};

export const EntryKind = {
  Unknown: 'unknown',
  Logger: 'logger',
  Text: 'text',
  Notification: 'notification',
} as const;

export type EntryKind = (typeof EntryKind)[keyof typeof EntryKind];

export const FieldKey = {
  UnixTime: 'UnixTime',
  Category: 'Category',
  LogLevel: 'LogLevel',
  Item: 'Item',
  Message: 'Message',
  CallerFile: 'CallerFile',
  CallerLine: 'CallerLine',
  CallerMember: 'CallerMember',
  VciId: 'VciId',
} as const;

export type FieldKey = (typeof FieldKey)[keyof typeof FieldKey];

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

export type Category = (typeof Category)[keyof typeof Category];

export const LogLevel = {
  Fatal: 100,
  Error: 200,
  Warning: 300,
  Info: 400,
  Debug: 500,
  Trace: 600,
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

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
        LogLevel.Trace,
      ) as LogLevel)
    : LogLevel.Trace;

export type Fields = { [key in FieldKey]?: string } & { [key: string]: string };

export const EntryMessage = {
  UnsupportedDataFormat: '[Unsupported data format]',
} as const;

export type EntryMessage = (typeof EntryMessage)[keyof typeof EntryMessage];

const parseUnixTime = (str: string): Date => {
  return new Date(Number.parseInt(str, 10) * 1000);
};

const parseMessageLogLevel = (
  defaultLogLevel: number,
  str: string,
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

const formatTimestamp = (timestamp: Date): string => {
  return Number.isFinite(timestamp.getTime())
    ? moment(timestamp).format('HH:mm:ss')
    : '--:--:--';
};

export interface Entry {
  readonly kind: EntryKind;
  readonly timestamp: Date;
  readonly logLevel: number;
  readonly category: Category;
  readonly message: string;
  readonly simpleVciId?: string;
  readonly fields: Fields;
}

export const make = (
  kind: EntryKind,
  fields?: Readonly<Fields>,
  simpleVciId?: string,
): Entry => {
  const mFields = Object.assign({}, fields);

  const mUnixTime = mFields.UnixTime;
  const timestamp = mUnixTime ? parseUnixTime(mUnixTime) : new Date(Number.NaN);

  const category = (mFields.Category as Category) ?? Category.Unknown;

  const mLevelStr = mFields.LogLevel;
  const mLevelNumber = mLevelStr ? logLevelFromLabel(mLevelStr) : Number.NaN;
  const mLogLevel = Number.isFinite(mLevelNumber)
    ? mLevelNumber
    : LogLevel.Debug;

  // ロガータイプで、ログレベルが Debug のときは、メッセージに含まれる
  // ログレベルを優先する
  const mMessage = mFields.Message;
  const [logLevel, message] =
    kind === EntryKind.Logger && mLogLevel === LogLevel.Debug && mMessage
      ? parseMessageLogLevel(mLogLevel, mMessage)
      : [mLogLevel, mMessage ?? ''];

  return {
    kind,
    timestamp,
    category,
    logLevel,
    message,
    simpleVciId,
    fields: mFields,
  };
};

const makeFromFields = (
  kind: EntryKind,
  fields: Fields,
  idMap: VciIdMap,
): [Entry, VciIdMap] => {
  const vciId_ = fields[FieldKey.VciId];
  const [simpleVciId, newIdMap] =
    vciId_ === undefined ? [undefined, idMap] : simplifyVciId(vciId_, idMap);
  return [make(kind, fields, simpleVciId), newIdMap];
};

export const fromText = (
  kind: EntryKind,
  logLevel: number,
  text: string,
): Entry =>
  make(kind, {
    LogLevel: logLevelToLabel(logLevel),
    Message: text,
  });

const fieldMapper = (v: unknown, k: string) =>
  k === FieldKey.Message && typeof v === 'string'
    ? parseMessageField(v)
    : String(v);

const parseFields = (
  fieldsNode: unknown,
  idMap: VciIdMap,
): [Entry, VciIdMap] =>
  R.is(Object, fieldsNode)
    ? makeFromFields(
        EntryKind.Logger,
        R.mapObjIndexed(fieldMapper, fieldsNode as Record<string, unknown>),
        idMap,
      )
    : [
        fromText(
          EntryKind.Notification,
          LogLevel.Error,
          EntryMessage.UnsupportedDataFormat,
        ),
        idMap,
      ];

export const fromStructure2 = (
  data: unknown,
  idMap: VciIdMap,
): [Entry, VciIdMap] =>
  Array.isArray(data) &&
  data.length >= 3 &&
  data[1] === 'logger' &&
  Array.isArray(data[2]) &&
  !R.isEmpty(data[2])
    ? parseFields(data[2][0], idMap)
    : [
        fromText(
          EntryKind.Notification,
          LogLevel.Error,
          EntryMessage.UnsupportedDataFormat,
        ),
        idMap,
      ];

/**
 * @deprecated Use `fromStructure2`
 */
export const fromStructure = (data: unknown) =>
  fromStructure2(data, new Map<string, string>())[0];

const immediateFieldMap: Readonly<
  Partial<Record<FieldKey, (entry: Entry) => string | undefined>>
> = {
  LogLevel: (entry) => logLevelToLabel(entry.logLevel),
  Message: (entry) => entry.message,
  Category: (entry) => entry.category,
  UnixTime: (entry) => formatTimestamp(entry.timestamp),
  VciId: (entry) => entry.simpleVciId ?? entry.fields[FieldKey.VciId],
};

export const fieldText = (
  fieldKey: FieldKey | string,
  entry: Entry,
): string | undefined =>
  fieldKey === FieldKey.LogLevel || fieldKey in entry.fields
    ? immediateFieldMap[fieldKey as FieldKey]?.(entry) ?? entry.fields[fieldKey]
    : undefined;

export const fieldTextOr = (
  defaultValue: string,
  fieldKey: FieldKey | string,
  entry: Entry,
): string => fieldText(fieldKey, entry) ?? defaultValue;
