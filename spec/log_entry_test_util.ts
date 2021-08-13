import * as R from 'ramda';

import { packageInfo } from '../src/lib//package_info';

import { FieldKey } from '../src/lib/vci_log_entry_formatter';

import { ConditionKind, Condition } from '../src/lib/vci_log_condition';

export const appCommandArgv: ReadonlyArray<string> = ['node', packageInfo.name];
export const timeFormatPattern = /^\d{2}:\d{2}:\d{2}/;
export const timeFormatLength = 8;

export const parseFullText = (
  text: string
): [Record<string, string>, string | undefined] => {
  const obj = R.fromPairs(
    text.split(' | ').map((val) => {
      const idx = val.indexOf(' = ');
      return idx >= 0
        ? [val.substring(0, idx), val.substring(idx + 3)]
        : ['', val];
    })
  );

  return [R.dissoc(FieldKey.UnixTime, obj), obj[FieldKey.UnixTime]];
};

export type CkNode = Readonly<{
  kind: ConditionKind;
  children: ReadonlyArray<CkNode>;
}>;

export const ckNode = (c: Condition): CkNode => ({
  kind: c.kind,
  children: c.children.map(ckNode),
});
