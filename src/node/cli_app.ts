import { ProgramOptions } from '../lib/program_options';

import { xs, vle, vls } from '../lib';

import { VciLogOutputData } from '../lib/vci_log_console_output_driver';

export type Sources = {
  props: xs<ProgramOptions>;
  vciLog: xs<vle.Entry>;
};

export type Sinks = {
  vciLog: xs<vls.SocketRequest>;
  output: xs<VciLogOutputData>;
};

export const app = ({ props, vciLog }: Sources): Sinks => {
  const request$ = props.map(
    (po): vls.SocketRequest => vls.makeConnectRequest(po.url)
  );

  const outputDataMapper =
    (formatter: vle.EntryTextFormatter) =>
    (entry: vle.Entry): VciLogOutputData => ({ entry, formatter });

  const output$ = props
    .map((po) =>
      vciLog
        .filter((entry) => po.condition.evaluate(entry))
        .map(outputDataMapper(po.logFormatter))
    )
    .flatten()
    .remember();

  return {
    vciLog: request$,
    output: output$,
  };
};
