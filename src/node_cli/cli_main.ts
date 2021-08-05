import xs from 'xstream';
import { run } from '@cycle/run';

import { makeProgramOptions, ProgramOptions } from '../lib/program_options';

import {
  makeVciLogSocketInputDriver,
  makeConnectRequest,
  SocketRequest,
  vle,
} from '../lib';

import {
  makeVciLogConsoleOututDriver,
  VciLogOutputData,
} from '../lib/vci_log_console_output_driver';

type Sources = {
  props: xs<ProgramOptions>;
  vciLog: xs<vle.Entry>;
};

type Sinks = {
  vciLog: xs<SocketRequest>;
  output: xs<VciLogOutputData>;
};

const main = ({ props, vciLog }: Sources): Sinks => {
  const request$ = props.map(
    (props): SocketRequest => makeConnectRequest(props.url)
  );

  const output$ = props
    .map((props) =>
      vciLog
        .filter((entry) => props.condition.evaluate(entry))
        .map(
          (entry): VciLogOutputData => ({
            entry,
            formatter: props.logFormatter,
          })
        )
    )
    .flatten()
    .remember();

  return {
    vciLog: request$,
    output: output$,
  };
};

(() => {
  const drivers = {
    props: () => xs.of(makeProgramOptions(process.argv)),
    vciLog: makeVciLogSocketInputDriver(),
    output: makeVciLogConsoleOututDriver(console),
  };

  run(main, drivers);
})();
