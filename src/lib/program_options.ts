import * as R from 'ramda';
import { Command, Option } from 'commander';

import { packageInfo } from './package_info';
import * as vle from './vci_log_entry_formatter';
import * as vlc from './vci_log_condition';

export type ProgramOptions = {
  readonly cmd: Command;
  readonly url: string;
  readonly logFormatter: vle.EntryTextFormatter;
  readonly condition: vlc.Condition;
};

const defaultUrl = 'ws://127.0.0.1:8080';

export const OutputFormat = {
  Default: 'default',
  JsonRecord: 'json_record',
  FullText: 'full_text',
} as const;

export type OutputFormat = typeof OutputFormat[keyof typeof OutputFormat];

const formatterMap: Readonly<Record<string, vle.EntryTextFormatter>> = {
  [OutputFormat.JsonRecord]: vle.jsonRecordFormatter,
  [OutputFormat.FullText]: vle.consoleStyledFullTextFormatter,
};

const selectOutputFormatter = R.cond<string[], vle.EntryTextFormatter>([
  [(key) => !!formatterMap[key], (key) => formatterMap[key]],
  [R.T, R.always(vle.consoleStyledDefaultTextFormatter)],
]);

const fieldTextKeys = [
  vle.FieldKey.LogLevel,
  vle.FieldKey.Category,
  vle.FieldKey.Item,
  vle.FieldKey.Message,
] as const;

const buildConditionalExpression = (() => {
  const allWarningsCondition = (enabled: boolean, condition: vlc.Condition) => {
    return enabled
      ? condition
      : vlc.andCondition(
          condition,
          vlc.notCondition(vlc.overFrameTimeWarningCondition())
        );
  };

  const outputSystemStatusCondition = (
    enabled: boolean,
    condition: vlc.Condition
  ) => {
    return enabled
      ? condition
      : vlc.andCondition(
          condition,
          vlc.notCondition(vlc.categoryCondition(vle.Category.SystemStatus))
        );
  };

  const suppressStateSharedVariableCondition = (
    enabled: boolean,
    condition: vlc.Condition
  ) => {
    return enabled
      ? vlc.andCondition(
          condition,
          vlc.notCondition(
            vlc.orCondition(
              vlc.categoryCondition(vle.Category.Item_State),
              vlc.categoryCondition(vle.Category.SharedVariable)
            )
          )
        )
      : condition;
  };

  const fieldIncludeCondition = (
    fieldKeys: ReadonlyArray<vle.FieldKey>,
    search: string,
    regexEnabled: boolean,
    condition: vlc.Condition
  ) =>
    search
      ? vlc.andCondition(
          condition,
          regexEnabled
            ? vlc.fallbackFieldMatchCondition(fieldKeys, search)
            : vlc.fieldIncludeCondition(fieldKeys, search)
        )
      : condition;

  const excludeTextCondition = (
    fieldKeys: ReadonlyArray<vle.FieldKey>,
    search: string,
    regexEnabled: boolean,
    condition: vlc.Condition
  ) =>
    search
      ? vlc.andCondition(
          condition,
          vlc.notCondition(
            regexEnabled
              ? vlc.fallbackFieldMatchCondition(fieldKeys, search)
              : vlc.fieldIncludeCondition(fieldKeys, search)
          )
        )
      : condition;

  const notificationCondition = (condition: vlc.Condition) => {
    return vlc.orCondition(
      condition,
      vlc.entryCondition(vle.EntryKind.Notification)
    );
  };

  return (cmd: Command): vlc.Condition => {
    const opts = cmd.opts();

    const itc = fieldIncludeCondition(
      fieldTextKeys,
      opts.includeText ?? '',
      !!opts.regexSearch,
      vlc.anyCondition()
    );

    const iic = fieldIncludeCondition(
      [vle.FieldKey.Item],
      opts.includeItem ?? '',
      !!opts.regexSearch,
      vlc.anyCondition()
    );

    const ic =
      opts.includeText && opts.includeItem
        ? vlc.orCondition(itc, iic)
        : vlc.andCondition(itc, iic);

    return R.pipe(
      R.partial(excludeTextCondition, [
        fieldTextKeys,
        opts.excludeText ?? '',
        !!opts.regexSearch,
      ]),
      R.partial(excludeTextCondition, [
        [vle.FieldKey.Item],
        opts.excludeItem ?? '',
        !!opts.regexSearch,
      ]),
      R.partial(allWarningsCondition, [!!opts.allWarnings]),
      R.partial(outputSystemStatusCondition, [!!opts.outputSystemStatus]),
      R.partial(suppressStateSharedVariableCondition, [
        !!opts.suppressStateSharedVariable,
      ]),
      notificationCondition
    )(ic);
  };
})();

export const makeProgramOptions = (argv: Array<string>): ProgramOptions => {
  const cmd = new Command();
  cmd
    .version(`${packageInfo.name} ${packageInfo.version}`)
    .usage('[options]')
    .option(
      '-c, --connect <url>',
      'specify the URL to connect VCI WebSocket console',
      defaultUrl
    )
    .addOption(
      new Option('-f, --format <format>', 'specify the output format')
        .default(OutputFormat.Default)
        .choices(R.values(OutputFormat))
    )
    .option(
      '-A, --all-warnings',
      'output all the warnings such as "frame: script not return"'
    )
    .option('--output-system-status', 'output the system status')
    .option(
      '-s, --suppress-state-shared-variable',
      'suppress "Item_State" and "SharedVariable" categories'
    )
    .option('-I, --include-text <text>', 'specify the text to include')
    .option('-X, --exclude-text <text>', 'specify the text to exclude')
    .option('-i, --include-item <name>', 'specify the item name to include')
    .option('-x, --exclude-item <name>', 'specify the item name to exclude')
    .option('-r, --regex-search', 'enable regular expression search')
    .parse(argv);

  const opts = cmd.opts();
  const url = typeof opts.connect === 'string' ? opts.connect : defaultUrl;

  const logFormatter = selectOutputFormatter(
    typeof opts.format === 'string'
      ? opts.format.toLowerCase()
      : OutputFormat.Default
  );

  const condition = buildConditionalExpression(cmd);

  return { cmd, url, logFormatter, condition };
};
