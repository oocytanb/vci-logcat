import { assert } from 'chai';
import * as R from 'ramda';
import chalk from 'chalk';

import {
  EntryKind,
  FieldKey,
  Category,
  LogLevel,
  make,
  fromText,
  fromStructure,
  fieldReducer,
  defaultTextFormatter,
  consoleStyledDefaultTextFormatter,
  fullTextFormatter,
  consoleStyledFullTextFormatter,
  jsonRecordFormatter,
} from '../src/lib/vci_log_entry_formatter';

import {
  timeFormatPattern,
  timeFormatLength,
  parseFullText,
} from './log_entry_test_util';

describe('vle formatter', () => {
  it('fieldReducer', () => {
    const e = fromText(EntryKind.Logger, LogLevel.Error, 'foo_msg');

    const r = R.reduce(
      fieldReducer(
        (prev: [string, string][], curr, key, _entry) => [
          ...prev,
          [key, String(curr)] as [string, string],
        ],
        e,
      ),
      [],
      [FieldKey.Message, FieldKey.Category, FieldKey.LogLevel, '_UNKNOWN_KEY_'],
    );

    assert.deepStrictEqual(r, [
      [FieldKey.Message, 'foo_msg'],
      [FieldKey.LogLevel, 'Error'],
    ]);
  });

  it('format Fatal', () => {
    const e = make(EntryKind.Notification, {
      LogLevel: 'fatal',
    });

    assert.strictEqual(defaultTextFormatter(e), 'Fatal');

    assert.strictEqual(
      consoleStyledDefaultTextFormatter(e),
      chalk.whiteBright.bgRed('Fatal'),
    );

    const [ft, ft_time] = parseFullText(fullTextFormatter(e));
    assert.deepStrictEqual(ft, {
      LogLevel: 'Fatal',
    });
    assert.isUndefined(ft_time);

    const [cft, cft_time] = parseFullText(consoleStyledFullTextFormatter(e));
    assert.deepStrictEqual(cft, {
      LogLevel: chalk.whiteBright.bgRed('Fatal'),
    });
    assert.isUndefined(cft_time);

    assert.deepStrictEqual(JSON.parse(jsonRecordFormatter(e)), {
      LogLevel: 'fatal',
    });
  });

  it('format Error', () => {
    const e = make(EntryKind.Logger, {
      LogLevel: 'ERROR',
      Category: Category.Item_ScriptError,
      Item: 'bar_name',
      Message: 'foo_msg',
      UnixTime: '50',
      CallerFile: 'baz_file.cs',
      CallerLine: '123',
      CallerMember: 'qux_member',
      _UNKNOWN_: 'Z',
    });

    const dt = defaultTextFormatter(e);
    assert.isTrue(timeFormatPattern.test(dt));
    assert.strictEqual(
      dt.substring(timeFormatLength),
      ' | Error | Item_ScriptError | bar_name | foo_msg',
    );

    const cdt = consoleStyledDefaultTextFormatter(e);
    assert.isTrue(timeFormatPattern.test(cdt));
    assert.strictEqual(
      cdt.substring(timeFormatLength),
      ` | ${chalk.whiteBright.bgRed(
        'Error',
      )} | Item_ScriptError | bar_name | foo_msg`,
    );

    const [ft, ft_time] = parseFullText(fullTextFormatter(e));
    assert.deepStrictEqual(ft, {
      LogLevel: 'Error',
      Category: 'Item_ScriptError',
      Item: 'bar_name',
      Message: 'foo_msg',
      CallerFile: 'baz_file.cs',
      CallerLine: '123',
      CallerMember: 'qux_member',
      _UNKNOWN_: 'Z',
    });
    assert.isTrue(ft_time && timeFormatPattern.test(ft_time));

    const [cft, cft_time] = parseFullText(consoleStyledFullTextFormatter(e));
    assert.deepStrictEqual(cft, {
      LogLevel: chalk.whiteBright.bgRed('Error'),
      Category: 'Item_ScriptError',
      Item: 'bar_name',
      Message: 'foo_msg',
      CallerFile: 'baz_file.cs',
      CallerLine: '123',
      CallerMember: 'qux_member',
      _UNKNOWN_: 'Z',
    });
    assert.isTrue(cft_time && timeFormatPattern.test(cft_time));

    assert.deepStrictEqual(JSON.parse(jsonRecordFormatter(e)), {
      LogLevel: 'ERROR',
      Category: 'Item_ScriptError',
      Item: 'bar_name',
      Message: 'foo_msg',
      CallerFile: 'baz_file.cs',
      CallerLine: '123',
      CallerMember: 'qux_member',
      UnixTime: '50',
      _UNKNOWN_: 'Z',
    });
  });

  it('format Warning', () => {
    const e = fromStructure([
      2,
      'logger',
      [
        {
          LogLevel: 'Debug',
          Item: 'bar_name',
          Message: 'WARN | w_msg',
        },
      ],
    ]);

    assert.strictEqual(defaultTextFormatter(e), 'Warning | bar_name | w_msg');

    assert.strictEqual(
      consoleStyledDefaultTextFormatter(e),
      `${chalk.black.bgYellowBright('Warning')} | bar_name | w_msg`,
    );

    const [ft, ft_time] = parseFullText(fullTextFormatter(e));
    assert.deepStrictEqual(ft, {
      LogLevel: 'Warning',
      Item: 'bar_name',
      Message: 'w_msg',
    });
    assert.isUndefined(ft_time);

    const [cft, cft_time] = parseFullText(consoleStyledFullTextFormatter(e));
    assert.deepStrictEqual(cft, {
      LogLevel: chalk.black.bgYellowBright('Warning'),
      Item: 'bar_name',
      Message: 'w_msg',
    });
    assert.isUndefined(cft_time);

    assert.deepStrictEqual(JSON.parse(jsonRecordFormatter(e)), {
      LogLevel: 'Debug',
      Item: 'bar_name',
      Message: 'WARN | w_msg',
    });
  });

  it('format Info', () => {
    const e = fromText(EntryKind.Logger, LogLevel.Info, 'foo_msg');

    assert.strictEqual(defaultTextFormatter(e), 'Info | foo_msg');

    assert.strictEqual(
      consoleStyledDefaultTextFormatter(e),
      `${chalk.black.bgGreenBright('Info')} | foo_msg`,
    );

    const [ft, ft_time] = parseFullText(fullTextFormatter(e));
    assert.deepStrictEqual(ft, {
      LogLevel: 'Info',
      Message: 'foo_msg',
    });
    assert.isUndefined(ft_time);

    const [cft, cft_time] = parseFullText(consoleStyledFullTextFormatter(e));
    assert.deepStrictEqual(cft, {
      LogLevel: chalk.black.bgGreenBright('Info'),
      Message: 'foo_msg',
    });
    assert.isUndefined(cft_time);

    assert.deepStrictEqual(JSON.parse(jsonRecordFormatter(e)), {
      LogLevel: 'Info',
      Message: 'foo_msg',
    });
  });

  it('format Debug', () => {
    const e = make(EntryKind.Unknown, {
      LogLevel: 'DEbug',
      Category: '',
      Item: '',
      Message: '',
      UnixTime: '',
    });

    assert.strictEqual(defaultTextFormatter(e), '--:--:-- | Debug |  |  | ');

    assert.strictEqual(
      consoleStyledDefaultTextFormatter(e),
      defaultTextFormatter(e),
    );

    const [ft, ft_time] = parseFullText(fullTextFormatter(e));
    assert.deepStrictEqual(ft, {
      LogLevel: 'Debug',
      Category: '',
      Item: '',
      Message: '',
    });
    assert.strictEqual(ft_time, '--:--:--');

    const [cft, cft_time] = parseFullText(consoleStyledFullTextFormatter(e));
    assert.deepStrictEqual(cft, ft);
    assert.strictEqual(cft_time, ft_time);

    assert.deepStrictEqual(JSON.parse(jsonRecordFormatter(e)), {
      LogLevel: 'DEbug',
      Category: '',
      Item: '',
      Message: '',
      UnixTime: '',
    });
  });

  it('format Trace', () => {
    const e = make(EntryKind.Logger, {
      LogLevel: 'Debug',
      Message: '[TRAce] tr_msg',
    });

    assert.strictEqual(defaultTextFormatter(e), 'Trace |  tr_msg');

    assert.strictEqual(
      consoleStyledDefaultTextFormatter(e),
      defaultTextFormatter(e),
    );

    const [ft, ft_time] = parseFullText(fullTextFormatter(e));
    assert.deepStrictEqual(ft, {
      LogLevel: 'Trace',
      Message: ' tr_msg',
    });
    assert.isUndefined(ft_time);

    const [cft, cft_time] = parseFullText(consoleStyledFullTextFormatter(e));
    assert.deepStrictEqual(cft, ft);
    assert.strictEqual(cft_time, ft_time);

    assert.deepStrictEqual(JSON.parse(jsonRecordFormatter(e)), {
      LogLevel: 'Debug',
      Message: '[TRAce] tr_msg',
    });
  });

  it('format VciId', () => {
    const e = make(
      EntryKind.Logger,
      {
        LogLevel: 'Debug',
        Message: '[TRAce] tr_msg',
        VciId: '12345678abcd1234abcd1234567890ab',
      },
      '12345678',
    );

    assert.strictEqual(defaultTextFormatter(e), 'Trace | 12345678 |  tr_msg');

    assert.strictEqual(
      consoleStyledDefaultTextFormatter(e),
      defaultTextFormatter(e),
    );

    const [ft, ft_time] = parseFullText(fullTextFormatter(e));
    assert.deepStrictEqual(ft, {
      LogLevel: 'Trace',
      VciId: '12345678',
      Message: ' tr_msg',
    });
    assert.isUndefined(ft_time);

    const [cft, cft_time] = parseFullText(consoleStyledFullTextFormatter(e));
    assert.deepStrictEqual(cft, ft);
    assert.strictEqual(cft_time, ft_time);

    assert.deepStrictEqual(JSON.parse(jsonRecordFormatter(e)), {
      LogLevel: 'Debug',
      VciId: '12345678abcd1234abcd1234567890ab',
      Message: '[TRAce] tr_msg',
    });
  });

  it('format VciId no-simpleVciId', () => {
    const e = make(EntryKind.Logger, {
      LogLevel: 'Debug',
      Message: '[TRAce] tr_msg',
      VciId: '12345678abcd1234abcd1234567890ab',
    });

    assert.strictEqual(
      defaultTextFormatter(e),
      'Trace | 12345678abcd1234abcd1234567890ab |  tr_msg',
    );

    assert.strictEqual(
      consoleStyledDefaultTextFormatter(e),
      defaultTextFormatter(e),
    );

    const [ft, ft_time] = parseFullText(fullTextFormatter(e));
    assert.deepStrictEqual(ft, {
      LogLevel: 'Trace',
      VciId: '12345678abcd1234abcd1234567890ab',
      Message: ' tr_msg',
    });
    assert.isUndefined(ft_time);

    const [cft, cft_time] = parseFullText(consoleStyledFullTextFormatter(e));
    assert.deepStrictEqual(cft, ft);
    assert.strictEqual(cft_time, ft_time);

    assert.deepStrictEqual(JSON.parse(jsonRecordFormatter(e)), {
      LogLevel: 'Debug',
      VciId: '12345678abcd1234abcd1234567890ab',
      Message: '[TRAce] tr_msg',
    });
  });
});
