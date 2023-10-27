import { assert } from 'chai';

import {
  EntryKind,
  FieldKey,
  Category,
  EntryMessage,
  LogLevel,
  logLevelFromLabel,
  logLevelToLabel,
  roundLogLevel,
  make,
  fromText,
  fromStructure,
  fromStructure2,
  fieldText,
  fieldTextOr,
  leadingVciId,
  simplifyVciId,
} from '../src/lib/vci_log_entry';

describe('vle VciId', () => {
  it('leadingVciId', () => {
    assert.strictEqual(leadingVciId(''), '');
    assert.strictEqual(leadingVciId('a'), 'a');
    assert.strictEqual(leadingVciId('abcdef'), 'abcdef');
    assert.strictEqual(leadingVciId('abcdefg'), 'abcdefg');
    assert.strictEqual(leadingVciId('abcdefgh'), 'abcdefg');
    assert.strictEqual(leadingVciId('abcdefgh-ijkl-mnop'), 'abcdefg');
    assert.strictEqual(leadingVciId('-'), '');
    assert.strictEqual(leadingVciId('--'), '');
    assert.strictEqual(leadingVciId('-ab-'), 'ab');
    assert.strictEqual(leadingVciId('ab-cd-ef'), 'abcdef');
    assert.strictEqual(leadingVciId('ab-cd-ef-g'), 'abcdefg');
    assert.strictEqual(leadingVciId('ab-cd-ef-gh'), 'abcdefg');
  });

  it('simplifyVciId', () => {
    let idm = new Map<string, string>();

    {
      const [s, d] = simplifyVciId('', idm);
      assert.strictEqual(s, '');
      assert.strictEqual(d.get(''), '');
      assert.notDeepEqual(d, idm);
      idm = d;
    }

    {
      const [s, d] = simplifyVciId('', idm);
      assert.strictEqual(s, '');
      assert.deepEqual(d, idm);
      idm = d;
    }

    {
      const [s, d] = simplifyVciId('a', idm);
      assert.strictEqual(s, 'a');
      assert.strictEqual(d.get('a'), 'a');
      assert.notDeepEqual(d, idm);
      idm = d;
    }

    {
      const [s, d] = simplifyVciId('a', idm);
      assert.strictEqual(s, 'a');
      assert.deepEqual(d, idm);
      idm = d;
    }

    {
      const [s, d] = simplifyVciId('abcdefgX', idm);
      assert.strictEqual(s, 'abcdefg');
      assert.strictEqual(d.get('abcdefg'), 'abcdefgX');
      assert.notDeepEqual(d, idm);
      idm = d;
    }

    {
      const [s, d] = simplifyVciId('abcdefgY', idm);
      assert.strictEqual(s, 'abcdefgY');
      assert.strictEqual(d.get('abcdefg'), 'abcdefgX');
      assert.isUndefined(d.get('abcdefgY'));
      assert.deepEqual(d, idm);
      idm = d;
    }

    {
      const [s, d] = simplifyVciId('ab-cd-ef-gY', idm);
      assert.strictEqual(s, 'ab-cd-ef-gY');
      assert.strictEqual(d.get('abcdefg'), 'abcdefgX');
      assert.isUndefined(d.get('ab-cd-ef-gY'));
      assert.deepEqual(d, idm);
      idm = d;
    }

    {
      const [s, d] = simplifyVciId('zy-xw-vu-ts-rq-po', idm);
      assert.strictEqual(s, 'zyxwvut');
      assert.strictEqual(d.get('zyxwvut'), 'zy-xw-vu-ts-rq-po');
      assert.isUndefined(d.get('zy-xw-vu-ts-rq-po'));
      assert.notDeepEqual(d, idm);
      idm = d;
    }

    {
      const [s, d] = simplifyVciId('zyxwvutsrqpo', idm);
      assert.strictEqual(s, 'zyxwvutsrqpo');
      assert.strictEqual(d.get('zyxwvut'), 'zy-xw-vu-ts-rq-po');
      assert.isUndefined(d.get('zyxwvutsrqpo'));
      assert.deepEqual(d, idm);
      idm = d;
    }
  });
});

describe('vle logLevel', () => {
  it('logLevelFromLabel', () => {
    assert.isNaN(logLevelFromLabel(''));
    assert.isNaN(logLevelFromLabel('__INVALID_LABEL__'));
    assert.strictEqual(logLevelFromLabel('Trace'), LogLevel.Trace);
    assert.strictEqual(logLevelFromLabel('DEBUG'), LogLevel.Debug);
    assert.strictEqual(logLevelFromLabel('info'), LogLevel.Info);
    assert.strictEqual(logLevelFromLabel('warNIng'), LogLevel.Warning);
    assert.strictEqual(logLevelFromLabel('WARN'), LogLevel.Warning);
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
  it('make unknown', () => {
    const e = make(EntryKind.Unknown);
    assert.strictEqual(e.kind, EntryKind.Unknown);
    assert.isNaN(e.timestamp.getTime());
    assert.strictEqual(e.logLevel, LogLevel.Debug);
    assert.strictEqual(e.category, Category.Unknown);
    assert.strictEqual(e.message, '');
    assert.deepStrictEqual(e.fields, {});
  });

  it('fromText', () => {
    const e = fromText(EntryKind.Logger, LogLevel.Warning, 'foo_log');
    assert.strictEqual(e.kind, EntryKind.Logger);
    assert.isNaN(e.timestamp.getTime());
    assert.strictEqual(e.logLevel, LogLevel.Warning);
    assert.strictEqual(e.category, Category.Unknown);
    assert.strictEqual(e.message, 'foo_log');
    assert.deepStrictEqual(e.fields, {
      LogLevel: 'Warning',
      Message: 'foo_log',
    });
  });

  it('fromStructure empty', () => {
    const e = fromStructure({});
    assert.strictEqual(e.kind, EntryKind.Notification);
    assert.isNaN(e.timestamp.getTime());
    assert.strictEqual(e.logLevel, LogLevel.Error);
    assert.strictEqual(e.category, Category.Unknown);
    assert.strictEqual(e.message, EntryMessage.UnsupportedDataFormat);
    assert.deepStrictEqual(e.fields, {
      LogLevel: 'Error',
      Message: EntryMessage.UnsupportedDataFormat,
    });
  });

  it('fromStructure NewItem', () => {
    const e = fromStructure([
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
    assert.deepStrictEqual(e.fields, {
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

  it('fromStructure quoted message', () => {
    const e = fromStructure([
      2,
      'logger',
      [
        {
          LogLevel: 'debug',
          Message: '"INVALIDLOGLEVEL | quated_msg"',
        },
      ],
    ]);

    assert.strictEqual(e.kind, EntryKind.Logger);
    assert.strictEqual(e.logLevel, LogLevel.Debug);
    assert.strictEqual(e.message, 'INVALIDLOGLEVEL | quated_msg');
    assert.deepStrictEqual(e.fields, {
      LogLevel: 'debug',
      Message: 'INVALIDLOGLEVEL | quated_msg',
    });
  });

  it('fromStructure unspported format', () => {
    const e = fromStructure([2, 'logger', ['unspported format']]);

    assert.strictEqual(e.kind, EntryKind.Notification);
    assert.strictEqual(e.logLevel, LogLevel.Error);
    assert.strictEqual(e.message, EntryMessage.UnsupportedDataFormat);
    assert.deepStrictEqual(e.fields, {
      LogLevel: 'Error',
      Message: EntryMessage.UnsupportedDataFormat,
    });
  });

  it('fromStructure2 basics', () => {
    let idm = new Map<string, string>();

    {
      const [e, d] = fromStructure2({}, idm);
      assert.strictEqual(e.kind, EntryKind.Notification);
      assert.isNaN(e.timestamp.getTime());
      assert.strictEqual(e.logLevel, LogLevel.Error);
      assert.strictEqual(e.category, Category.Unknown);
      assert.strictEqual(e.message, EntryMessage.UnsupportedDataFormat);
      assert.deepStrictEqual(e.fields, {
        LogLevel: 'Error',
        Message: EntryMessage.UnsupportedDataFormat,
      });

      assert.isUndefined(e.simpleVciId);
      assert.deepEqual(d, idm);
      idm = d;
    }

    {
      const [e, d] = fromStructure2(
        [
          2,
          'logger',
          [
            {
              UnixTime: '2678450',
              Category: 'System',
              LogLevel: 'Debug',
              Message: 'new main',
              CallerFile: 'VciEmbeddedSceneScope.cs',
              CallerLine: 362,
            },
          ],
        ],
        idm,
      );

      assert.strictEqual(e.kind, EntryKind.Logger);
      assert.strictEqual(e.timestamp.getTime(), 2678450 * 1000);
      assert.strictEqual(e.logLevel, LogLevel.Debug);
      assert.strictEqual(e.category, Category.System);
      assert.strictEqual(e.message, 'new main');
      assert.deepStrictEqual(e.fields, {
        UnixTime: '2678450',
        Category: 'System',
        LogLevel: 'Debug',
        Message: 'new main',
        CallerFile: 'VciEmbeddedSceneScope.cs',
        CallerLine: '362',
      });

      assert.isUndefined(e.simpleVciId);
      assert.deepEqual(d, idm);
      idm = d;
    }

    {
      const [e, d] = fromStructure2(
        [
          2,
          'logger',
          [
            {
              UnixTime: '2678450',
              Category: 'Item_Print',
              LogLevel: 'Debug',
              Item: 'foo_item',
              VciId: '12345678abcd1234abcd1234567890ab',
              Message: 'print_message',
            },
          ],
        ],
        idm,
      );

      assert.strictEqual(e.kind, EntryKind.Logger);
      assert.strictEqual(e.timestamp.getTime(), 2678450 * 1000);
      assert.strictEqual(e.logLevel, LogLevel.Debug);
      assert.strictEqual(e.category, Category.Item_Print);
      assert.strictEqual(e.message, 'print_message');
      assert.deepStrictEqual(e.fields, {
        UnixTime: '2678450',
        Category: 'Item_Print',
        LogLevel: 'Debug',
        Item: 'foo_item',
        VciId: '12345678abcd1234abcd1234567890ab',
        Message: 'print_message',
      });

      assert.strictEqual(e.simpleVciId, '1234567');
      assert.notDeepEqual(d, idm);
      idm = d;
    }

    {
      const [e, d] = fromStructure2(
        [
          2,
          'logger',
          [
            {
              UnixTime: '2678450',
              Category: 'Item_Print',
              LogLevel: 'Debug',
              Item: 'foo_item',
              VciId: '1234567890EFEF1234abcd1234567890ab',
              Message: 'print_message',
            },
          ],
        ],
        idm,
      );

      assert.strictEqual(e.kind, EntryKind.Logger);
      assert.strictEqual(e.timestamp.getTime(), 2678450 * 1000);
      assert.strictEqual(e.logLevel, LogLevel.Debug);
      assert.strictEqual(e.category, Category.Item_Print);
      assert.strictEqual(e.message, 'print_message');
      assert.deepStrictEqual(e.fields, {
        UnixTime: '2678450',
        Category: 'Item_Print',
        LogLevel: 'Debug',
        Item: 'foo_item',
        VciId: '1234567890EFEF1234abcd1234567890ab',
        Message: 'print_message',
      });

      assert.strictEqual(e.simpleVciId, '1234567890EFEF1234abcd1234567890ab');
      assert.deepEqual(d, idm);
      idm = d;
    }
  });

  it('fieldText', () => {
    const e = fromText(EntryKind.Logger, LogLevel.Fatal, 'foo_msg');

    assert.strictEqual(fieldText(FieldKey.Category, e), undefined);
    assert.strictEqual(fieldText('_UNKNOWN_KEY_', e), undefined);
    assert.strictEqual(fieldText(FieldKey.LogLevel, e), 'Fatal');
    assert.strictEqual(fieldText(FieldKey.Message, e), 'foo_msg');
  });

  it('fieldText VciId', () => {
    let idm = new Map<string, string>();

    {
      const [e, d] = fromStructure2({}, idm);

      assert.strictEqual(fieldText(FieldKey.VciId, e), undefined);
      idm = d;
    }

    {
      const [e, d] = fromStructure2(
        [
          2,
          'logger',
          [
            {
              UnixTime: '2678450',
              Category: 'Item_Print',
              LogLevel: 'Debug',
              Item: 'foo_item',
              VciId: '12345678abcd1234abcd1234567890ab',
              Message: 'print_message',
            },
          ],
        ],
        idm,
      );

      assert.strictEqual(fieldText(FieldKey.VciId, e), '1234567');
      idm = d;
    }

    {
      const [e, d] = fromStructure2(
        [
          2,
          'logger',
          [
            {
              UnixTime: '2678450',
              Category: 'Item_Print',
              LogLevel: 'Debug',
              Item: 'foo_item',
              VciId: '1234567890EFEF1234abcd1234567890ab',
              Message: 'print_message',
            },
          ],
        ],
        idm,
      );

      assert.strictEqual(
        fieldText(FieldKey.VciId, e),
        '1234567890EFEF1234abcd1234567890ab',
      );

      idm = d;
    }

    {
      const [e, d] = fromStructure2(
        [
          2,
          'logger',
          [
            {
              UnixTime: '2678450',
              Category: 'Item_Print',
              LogLevel: 'Debug',
              Item: 'foo_item',
              VciId: '12-34-56-78-90-EF-EF-12-34-ab-cd-12-34-56-78-90-ab',
              Message: 'print_message',
            },
          ],
        ],
        idm,
      );

      assert.strictEqual(
        fieldText(FieldKey.VciId, e),
        '12-34-56-78-90-EF-EF-12-34-ab-cd-12-34-56-78-90-ab',
      );

      idm = d;
    }

    {
      const [e, d] = fromStructure2(
        [
          2,
          'logger',
          [
            {
              UnixTime: '2678450',
              Category: 'Item_Print',
              LogLevel: 'Debug',
              Item: 'foo_item',
              VciId: 'zy-xw-vu-ts-rq',
              Message: 'print_message',
            },
          ],
        ],
        idm,
      );

      assert.strictEqual(fieldText(FieldKey.VciId, e), 'zyxwvut');

      idm = d;
    }

    {
      const [e, d] = fromStructure2(
        [
          2,
          'logger',
          [
            {
              UnixTime: '2678450',
              Category: 'Item_Print',
              LogLevel: 'Debug',
              Item: 'foo_item',
              VciId: 'zyxwvutsrq',
              Message: 'print_message',
            },
          ],
        ],
        idm,
      );

      assert.strictEqual(fieldText(FieldKey.VciId, e), 'zyxwvutsrq');

      idm = d;
    }
  });

  it('fieldTextOr', () => {
    const e = fromText(EntryKind.Logger, LogLevel.Warning, 'foo_msg');

    assert.strictEqual(fieldTextOr('_DEF_', FieldKey.Category, e), '_DEF_');
    assert.strictEqual(fieldTextOr('_DEF_', '_UNKNOWN_KEY_', e), '_DEF_');
    assert.strictEqual(fieldTextOr('_DEF_', FieldKey.LogLevel, e), 'Warning');
    assert.strictEqual(fieldTextOr('_DEF_', FieldKey.Message, e), 'foo_msg');
  });
});
