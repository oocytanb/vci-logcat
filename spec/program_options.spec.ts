import { assert } from 'chai';
import chalk from 'chalk';

import {
  EntryKind,
  Category,
  make,
  fromText,
  LogLevel,
} from '../src/lib/vci_log_entry';

import { ConditionKind } from '../src/lib/vci_log_condition';

import { makeProgramOptions } from '../src/lib/program_options';

import {
  appCommandArgv,
  timeFormatPattern,
  parseFullText,
  ckNode,
} from './log_entry_test_util';

describe('program_options', () => {
  it('makeProgramOptions default', () => {
    const { condition, logFormatter, url } = makeProgramOptions([
      ...appCommandArgv,
    ]);

    assert.strictEqual(url, 'ws://127.0.0.1:8080');

    assert.deepStrictEqual(ckNode(condition), {
      kind: ConditionKind.OrOperator,
      children: [
        {
          kind: ConditionKind.AndOperator,
          children: [
            {
              kind: ConditionKind.NotOperator,
              children: [
                {
                  kind: ConditionKind.OverFrameTimeWarning,
                  children: [],
                },
              ],
            },
            {
              kind: ConditionKind.NotOperator,
              children: [
                {
                  kind: ConditionKind.Category,
                  children: [],
                },
              ],
            },
          ],
        },
        {
          kind: ConditionKind.EntryKind,
          children: [],
        },
      ],
    });

    const e1 = fromText(EntryKind.Notification, LogLevel.Trace, 'notify');
    assert.isTrue(condition.evaluate(e1));
    assert.strictEqual(logFormatter(e1), 'Trace | notify');

    const e2 = fromText(EntryKind.Logger, LogLevel.Debug, 'typical_msg');
    assert.isTrue(condition.evaluate(e2));
    assert.strictEqual(logFormatter(e2), 'Debug | typical_msg');

    const e3 = make(EntryKind.Logger, {
      Category: Category.System,
      LogLevel: 'Warning',
      Message: 'frame: script not return',
    });
    assert.isFalse(condition.evaluate(e3));

    const e4 = make(EntryKind.Logger, {
      Category: Category.Unknown,
      LogLevel: 'Warning',
      Message: 'frame: script not return',
    });
    assert.isTrue(condition.evaluate(e4));
    assert.strictEqual(
      logFormatter(e4),
      `${chalk.black.bgYellowBright('Warning')} |  | frame: script not return`
    );

    const e5 = make(EntryKind.Logger, {
      Category: Category.SystemStatus,
      LogLevel: 'Debug',
      Message: 'notify_fps',
    });
    assert.isFalse(condition.evaluate(e5));

    const e6 = make(EntryKind.Logger, {
      Category: Category.SharedVariable,
      LogLevel: 'Info',
      Message: '{studio.shared}',
    });
    assert.isTrue(condition.evaluate(e6));
    assert.strictEqual(
      logFormatter(e6),
      `${chalk.black.bgGreenBright('Info')} | SharedVariable | {studio.shared}`
    );

    const e7 = make(EntryKind.Logger, {
      Category: Category.Item_State,
      LogLevel: '_INVLEVEL_',
      Message: '{vci.state}',
    });
    assert.isTrue(condition.evaluate(e7));
    assert.strictEqual(logFormatter(e7), 'Debug | Item_State | {vci.state}');
  });

  it('makeProgramOptions full_text', () => {
    const { condition, logFormatter, url } = makeProgramOptions(
      appCommandArgv.concat(
        '-s',
        '-I',
        'foo',
        '-c',
        '192.168.0.1:80',
        '-f',
        'full_text'
      )
    );

    assert.strictEqual(url, '192.168.0.1:80');

    assert.deepStrictEqual(ckNode(condition), {
      kind: ConditionKind.OrOperator,
      children: [
        {
          kind: ConditionKind.AndOperator,
          children: [
            {
              kind: ConditionKind.FieldInclude,
              children: [],
            },
            {
              kind: ConditionKind.NotOperator,
              children: [
                {
                  kind: ConditionKind.OverFrameTimeWarning,
                  children: [],
                },
              ],
            },
            {
              kind: ConditionKind.NotOperator,
              children: [
                {
                  kind: ConditionKind.Category,
                  children: [],
                },
              ],
            },
            {
              kind: ConditionKind.NotOperator,
              children: [
                {
                  kind: ConditionKind.OrOperator,
                  children: [
                    {
                      kind: ConditionKind.Category,
                      children: [],
                    },
                    {
                      kind: ConditionKind.Category,
                      children: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          kind: ConditionKind.EntryKind,
          children: [],
        },
      ],
    });

    const e1 = fromText(EntryKind.Notification, LogLevel.Trace, 'notify');
    assert.isTrue(condition.evaluate(e1));
    const [f1, ft1] = parseFullText(logFormatter(e1));
    assert.deepStrictEqual(f1, {
      LogLevel: 'Trace',
      Message: 'notify',
    });
    assert.isUndefined(ft1);

    const e2 = fromText(EntryKind.Logger, LogLevel.Debug, 'typical_msg');
    assert.isFalse(condition.evaluate(e2));

    const e3 = fromText(EntryKind.Logger, LogLevel.Error, 'errFOO ');
    assert.isTrue(condition.evaluate(e3));
    const [f3, ft3] = parseFullText(logFormatter(e3));
    assert.deepStrictEqual(f3, {
      LogLevel: chalk.whiteBright.bgRed('Error'),
      Message: 'errFOO ',
    });
    assert.isUndefined(ft3);

    const e4 = make(EntryKind.Logger, {
      LogLevel: 'FATAL',
      Item: '__fOo__',
      UnixTime: '20',
    });
    assert.isTrue(condition.evaluate(e4));
    const [f4, ft4] = parseFullText(logFormatter(e4));
    assert.deepStrictEqual(f4, {
      LogLevel: chalk.whiteBright.bgRed('Fatal'),
      Item: '__fOo__',
    });
    assert.isTrue(ft4 && timeFormatPattern.test(ft4));

    const e6 = make(EntryKind.Logger, {
      Category: Category.SharedVariable,
      LogLevel: 'Info',
      Message: '{studio.shared}',
    });
    assert.isFalse(condition.evaluate(e6));

    const e7 = make(EntryKind.Logger, {
      Category: Category.Item_State,
      LogLevel: 'Debug',
      Message: '{vci.state}',
    });
    assert.isFalse(condition.evaluate(e7));
  });

  it('makeProgramOptions json_record', () => {
    const { condition, logFormatter, url } = makeProgramOptions(
      appCommandArgv.concat(
        '-I',
        'foo',
        '-i',
        'BAR',
        '-X',
        'hoge',
        '-x',
        'PIYO',
        '-A',
        '--output-system-status',
        '-c',
        '',
        '-f',
        'json_record'
      )
    );

    assert.strictEqual(url, '');

    assert.deepStrictEqual(ckNode(condition), {
      kind: ConditionKind.OrOperator,
      children: [
        {
          kind: ConditionKind.AndOperator,
          children: [
            {
              kind: ConditionKind.OrOperator,
              children: [
                {
                  kind: ConditionKind.FieldInclude,
                  children: [],
                },
                {
                  kind: ConditionKind.FieldInclude,
                  children: [],
                },
              ],
            },
            {
              kind: ConditionKind.NotOperator,
              children: [
                {
                  kind: ConditionKind.FieldInclude,
                  children: [],
                },
              ],
            },
            {
              kind: ConditionKind.NotOperator,
              children: [
                {
                  kind: ConditionKind.FieldInclude,
                  children: [],
                },
              ],
            },
          ],
        },
        {
          kind: ConditionKind.EntryKind,
          children: [],
        },
      ],
    });

    const e1 = fromText(EntryKind.Notification, LogLevel.Info, 'hoge');
    assert.isTrue(condition.evaluate(e1));
    assert.deepStrictEqual(JSON.parse(logFormatter(e1)), {
      LogLevel: 'Info',
      Message: 'hoge',
    });

    const e2 = fromText(EntryKind.Logger, LogLevel.Info, 'hoge');
    assert.isFalse(condition.evaluate(e2));

    const e3 = fromText(EntryKind.Text, LogLevel.Error, 'FOOmsg');
    assert.isTrue(condition.evaluate(e3));
    assert.deepStrictEqual(JSON.parse(logFormatter(e3)), {
      LogLevel: 'Error',
      Message: 'FOOmsg',
    });

    const e4 = fromText(EntryKind.Logger, LogLevel.Info, 'msg');
    assert.isFalse(condition.evaluate(e4));

    const e5 = make(EntryKind.Text, {
      Item: '_bar_',
    });
    assert.isTrue(condition.evaluate(e5));
    assert.deepStrictEqual(JSON.parse(logFormatter(e5)), {
      Item: '_bar_',
    });

    const e6 = make(EntryKind.Text, {
      Message: '_bar_',
    });
    assert.isFalse(condition.evaluate(e6));

    const e7 = make(EntryKind.Text, {
      Item: '_bar_',
      Message: '_hOge_',
    });
    assert.isFalse(condition.evaluate(e7));

    const e8 = make(EntryKind.Text, {
      Item: '_bar_',
      Message: '_PiYo_',
    });
    assert.isTrue(condition.evaluate(e8));
    assert.deepStrictEqual(JSON.parse(logFormatter(e8)), {
      Item: '_bar_',
      Message: '_PiYo_',
    });

    const e9 = make(EntryKind.Text, {
      Item: '_bar_PiYo_',
      Message: 'qux_msg',
    });
    assert.isFalse(condition.evaluate(e9));

    const e10 = make(EntryKind.Logger, {
      Category: Category.System,
      LogLevel: 'WARN',
      Item: 'FOO_TAIL',
      Message: 'frame: script not return',
    });
    assert.isTrue(condition.evaluate(e10));
    assert.deepStrictEqual(JSON.parse(logFormatter(e10)), {
      Category: Category.System,
      LogLevel: 'WARN',
      Item: 'FOO_TAIL',
      Message: 'frame: script not return',
    });

    const e11 = make(EntryKind.Logger, {
      Category: Category.SystemStatus,
      LogLevel: 'trace',
      Item: 'FOO_TAIL',
      Message: 'stat: fps',
    });
    assert.isTrue(condition.evaluate(e11));
    assert.deepStrictEqual(JSON.parse(logFormatter(e11)), {
      Category: Category.SystemStatus,
      LogLevel: 'trace',
      Item: 'FOO_TAIL',
      Message: 'stat: fps',
    });
  });

  it('makeProgramOptions regex', () => {
    const { condition, logFormatter } = makeProgramOptions(
      appCommandArgv.concat(
        '-I',
        '^foo$',
        '-i',
        '**BAR**',
        '-X',
        '??hoge',
        '-x',
        'PIYO|FUGA',
        '-r',
        '-A',
        '--output-system-status'
      )
    );

    assert.deepStrictEqual(ckNode(condition), {
      kind: ConditionKind.OrOperator,
      children: [
        {
          kind: ConditionKind.AndOperator,
          children: [
            {
              kind: ConditionKind.OrOperator,
              children: [
                {
                  kind: ConditionKind.FieldMatch,
                  children: [],
                },
                {
                  kind: ConditionKind.FieldInclude,
                  children: [],
                },
              ],
            },
            {
              kind: ConditionKind.NotOperator,
              children: [
                {
                  kind: ConditionKind.FieldInclude,
                  children: [],
                },
              ],
            },
            {
              kind: ConditionKind.NotOperator,
              children: [
                {
                  kind: ConditionKind.FieldMatch,
                  children: [],
                },
              ],
            },
          ],
        },
        {
          kind: ConditionKind.EntryKind,
          children: [],
        },
      ],
    });

    const e1 = make(EntryKind.Notification, {
      LogLevel: 'DEBUG',
      Item: 'TEXfuga',
      Message: 'foo',
    });
    assert.isTrue(condition.evaluate(e1));
    assert.strictEqual(logFormatter(e1), 'Debug | TEXfuga | foo');

    const e2 = make(EntryKind.Logger, {
      LogLevel: 'DEBUG',
      Item: 'TEXfuga',
      Message: 'foo',
    });
    assert.isFalse(condition.evaluate(e2));

    const e3 = make(EntryKind.Logger, {
      LogLevel: 'debug',
      Item: 'Poo and ??HoGe',
      Message: 'foo',
    });
    assert.isFalse(condition.evaluate(e3));

    const e4 = make(EntryKind.Logger, {
      LogLevel: 'debug',
      Message: 'foo',
      _UNKNOWN_: 'Poo and ??HoGe',
    });
    assert.isTrue(condition.evaluate(e4));
    assert.strictEqual(logFormatter(e4), 'Debug | foo');

    const e5 = make(EntryKind.Logger, {
      LogLevel: 'debug',
      Message: ' foo',
    });
    assert.isFalse(condition.evaluate(e5));

    const e6 = make(EntryKind.Logger, {
      LogLevel: 'TRACE',
      Item: 'dot**BAR**',
    });
    assert.isTrue(condition.evaluate(e6));
    assert.strictEqual(logFormatter(e6), 'Trace | dot**BAR**');

    const e7 = make(EntryKind.Logger, {
      LogLevel: 'TRACE',
      Item: 'dotBARBAR',
    });
    assert.isFalse(condition.evaluate(e7));
  });
});
