import { assert } from 'chai';

import * as R from 'ramda';

import { xs, vle, vls } from '../src/lib/';
import { makeProgramOptions } from '../src/lib/program_options';
import { app } from '../src/node/cli_app';

import { appCommandArgv } from './log_entry_test_util';

describe('cli_app', () => {
  it('app', () => {
    const po = makeProgramOptions([...appCommandArgv, '-X', 'qux']);
    const entries = [
      vle.fromText(
        vle.EntryKind.Notification,
        vle.LogLevel.Trace,
        'notify qux'
      ),
      vle.fromText(vle.EntryKind.Logger, vle.LogLevel.Debug, 'foo msg'),
      vle.fromText(vle.EntryKind.Logger, vle.LogLevel.Debug, 'qux msg'),
    ];

    const { vciLog, output } = app({
      props: xs.of(po),
      vciLog: xs.fromArray(entries),
    });

    const reqs: vls.SocketRequest[] = [];
    vciLog
      .subscribe({
        next: R.bind(reqs.push, reqs),
      })
      .unsubscribe();

    assert.deepStrictEqual(reqs, [{ kind: 'connect', url: po.url }]);

    const logs: string[] = [];
    output
      .subscribe({
        next: ({ entry, formatter }) => {
          assert.strictEqual(formatter, po.logFormatter);
          if (formatter !== undefined) {
            logs.push(formatter(entry));
          }
        },
      })
      .unsubscribe();

    assert.deepStrictEqual(logs, ['Trace | notify qux', 'Debug | foo msg']);
  });
});
