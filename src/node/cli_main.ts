import xs from 'xstream';
import { run } from '@cycle/run';

import { makeProgramOptions } from '../lib/program_options';

import { makeVciLogSocketDriver } from '../lib/vci_log_socket_driver';

import { makeVciLogConsoleOututDriver } from '../lib/vci_log_console_output_driver';

import { app } from './cli_app';

run(app, {
  props: () => xs.of(makeProgramOptions(process.argv)),
  vciLog: makeVciLogSocketDriver(),
  output: makeVciLogConsoleOututDriver(console),
});
