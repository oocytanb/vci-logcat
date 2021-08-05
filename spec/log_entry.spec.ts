import { assert } from 'chai';

import {
  Entry,
  EntryKind,
  Category,
  EntryMessage,
  LogLevel,
  logLevelFromLabel,
  logLevelToLabel,
  roundLogLevel,
} from '../src/lib/vci_log_entry';

describe('vle logLevel', () => {
  it('logLevelFromLabel', () => {
    assert.isNaN(logLevelFromLabel(''));
    assert.isNaN(logLevelFromLabel('__INVALID_LABEL__'));
    assert.strictEqual(logLevelFromLabel('Trace'), LogLevel.Trace);
    assert.strictEqual(logLevelFromLabel('DEBUG'), LogLevel.Debug);
    assert.strictEqual(logLevelFromLabel('info'), LogLevel.Info);
    assert.strictEqual(logLevelFromLabel('warNIng'), LogLevel.Warning);
    assert.strictEqual(logLevelFromLabel('errOR'), LogLevel.Error);
    assert.strictEqual(logLevelFromLabel('fataL'), LogLevel.Fatal);
  });

  it('logLevelToLabel', () => {
    assert.strictEqual(logLevelToLabel(Number.NaN), '0');
    assert.strictEqual(logLevelToLabel(-1), '-1');
    assert.strictEqual(logLevelToLabel(0), '0');
    assert.strictEqual(logLevelToLabel(0.1), '0');
    assert.strictEqual(logLevelToLabel(1), '1');
    assert.strictEqual(logLevelToLabel(LogLevel.Trace), 'Trace');
    assert.strictEqual(logLevelToLabel(LogLevel.Debug), 'Debug');
    assert.strictEqual(logLevelToLabel(LogLevel.Info), 'Info');
    assert.strictEqual(logLevelToLabel(LogLevel.Warning), 'Warning');
    assert.strictEqual(logLevelToLabel(LogLevel.Error), 'Error');
    assert.strictEqual(logLevelToLabel(LogLevel.Fatal), 'Fatal');
  });

  it('roundLogLevel', () => {
    assert.strictEqual(roundLogLevel(Number.NaN), LogLevel.Trace);
    assert.strictEqual(roundLogLevel(-1), LogLevel.Fatal);
    assert.strictEqual(roundLogLevel(0), LogLevel.Fatal);
    assert.strictEqual(roundLogLevel(0.1), LogLevel.Fatal);
    assert.strictEqual(roundLogLevel(1), LogLevel.Fatal);
    assert.strictEqual(roundLogLevel(LogLevel.Fatal - 1), LogLevel.Fatal);
    assert.strictEqual(roundLogLevel(LogLevel.Fatal), LogLevel.Fatal);
    assert.strictEqual(roundLogLevel(LogLevel.Fatal + 1), LogLevel.Error);
    assert.strictEqual(roundLogLevel(LogLevel.Error - 1), LogLevel.Error);
    assert.strictEqual(roundLogLevel(LogLevel.Error), LogLevel.Error);
    assert.strictEqual(roundLogLevel(LogLevel.Error + 1), LogLevel.Warning);
    assert.strictEqual(roundLogLevel(LogLevel.Warning), LogLevel.Warning);
    assert.strictEqual(roundLogLevel(LogLevel.Info), LogLevel.Info);
    assert.strictEqual(roundLogLevel(LogLevel.Debug), LogLevel.Debug);
    assert.strictEqual(roundLogLevel(LogLevel.Trace - 1), LogLevel.Trace);
    assert.strictEqual(roundLogLevel(LogLevel.Trace), LogLevel.Trace);
    assert.strictEqual(roundLogLevel(LogLevel.Trace + 1), LogLevel.Trace);
  });
});

describe('vle Entry', () => {
  it('.make unknown', () => {
    const e = Entry.make(EntryKind.Unknown);
    assert.strictEqual(e.kind, EntryKind.Unknown);
    assert.isNaN(e.timestamp.getTime());
    assert.strictEqual(e.logLevel, LogLevel.Debug);
    assert.strictEqual(e.category, Category.Unknown);
    assert.strictEqual(e.message, '');
    assert.deepEqual(e.fields, {});
  });

  it('.fromText', () => {
    const e = Entry.fromText(EntryKind.Logger, LogLevel.Warning, 'foo_log');
    assert.strictEqual(e.kind, EntryKind.Logger);
    assert.isNaN(e.timestamp.getTime());
    assert.strictEqual(e.logLevel, LogLevel.Warning);
    assert.strictEqual(e.category, Category.Unknown);
    assert.strictEqual(e.message, 'foo_log');
    assert.deepEqual(e.fields, {
      LogLevel: 'Warning',
      Message: 'foo_log',
    });
  });

  it('.fromStructure empty', () => {
    const e = Entry.fromStructure({});
    assert.strictEqual(e.kind, EntryKind.Notification);
    assert.isNaN(e.timestamp.getTime());
    assert.strictEqual(e.logLevel, LogLevel.Error);
    assert.strictEqual(e.category, Category.Unknown);
    assert.strictEqual(e.message, EntryMessage.UnsupportedDataFormat);
    assert.deepEqual(e.fields, {
      LogLevel: 'Error',
      Message: EntryMessage.UnsupportedDataFormat,
    });
  });

  it('.fromStructure NewItem', () => {
    const e = Entry.fromStructure([
      2,
      'logger',
      [
        {
          UnixTime: '2678450',
          Category: 'Item_Print',
          LogLevel: 'Debug',
          Item: 'foo_vci',
          Message: 'write foo_vci/_main.lua',
          CallerFile: 'EmbeddedScriptUnitySide.cs',
          CallerLine: 262,
          CallerMember: '_NewItem',
        },
      ],
    ]);

    assert.strictEqual(e.kind, EntryKind.Logger);
    assert.strictEqual(e.timestamp.getTime(), 2678450 * 1000);
    assert.strictEqual(e.logLevel, LogLevel.Debug);
    assert.strictEqual(e.category, Category.Item_Print);
    assert.strictEqual(e.message, 'write foo_vci/_main.lua');
    assert.deepEqual(e.fields, {
      UnixTime: '2678450',
      Category: 'Item_Print',
      LogLevel: 'Debug',
      Item: 'foo_vci',
      Message: 'write foo_vci/_main.lua',
      CallerFile: 'EmbeddedScriptUnitySide.cs',
      CallerLine: '262',
      CallerMember: '_NewItem',
    });
  });
});
