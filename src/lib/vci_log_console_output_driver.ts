import xs from 'xstream';

import * as vle from './vci_log_entry_formatter';

export type VciLogOutputData = {
  entry: vle.Entry;
  formatter?: vle.EntryTextFormatter;
};

export const makeVciLogConsoleOututDriver = (
  console: Console
): typeof consoleDriver => {
  const consoleDriver = (outputData$: xs<VciLogOutputData>) => {
    outputData$.addListener({
      next: (outputData) => {
        const entry = outputData.entry;
        const formatter =
          outputData.formatter ?? vle.consoleStyledDefaultTextFormatter;
        const msg = formatter(entry);
        if (entry.kind == vle.EntryKind.Notification) {
          console.warn(msg);
        } else {
          console.log(msg);
        }
      },
    });
  };
  return consoleDriver;
};
