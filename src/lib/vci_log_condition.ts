import * as R from 'ramda';

import * as vle from './vci_log_entry';

export const ConditionKind = {
  Any: 'ANY',
  NotOperator: 'NOT',
  AndOperator: 'AND',
  OrOperator: 'OR',
  EntryKind: '__ENTRY_KIND',
  Category: '__CATEGORY',
  OverFrameTimeWarning: '__OVER_FRAME_TIME_WARNING',
  FieldEqual: '__FIELD_EQUAL',
  FieldInclude: '__FIELD_INCLUDE',
  FieldMatch: '__FIELD_MATCH',
} as const;

export type ConditionKind = typeof ConditionKind[keyof typeof ConditionKind];

export interface Condition {
  readonly kind: ConditionKind;
  readonly children: ReadonlyArray<Condition>;
  readonly evaluate: (entry: vle.Entry) => boolean;
}

export type TextMapper = (str: string) => string;

type TextTester = (str: string) => boolean;

const fieldTextEvaluator = (
  fieldTester: TextTester,
  fieldKeys: ReadonlyArray<vle.FieldKey>
) => {
  return (entry: vle.Entry) =>
    R.any((key) => {
      const fieldVal = entry.fields[key];
      return R.isNil(fieldVal) ? false : fieldTester(fieldVal);
    }, fieldKeys);
};

class AnyCondition implements Condition {
  kind: ConditionKind;
  children: ReadonlyArray<Condition>;

  constructor() {
    this.kind = ConditionKind.Any;
    this.children = [];
  }

  evaluate(_entry: vle.Entry) {
    return true;
  }
}

class NotCondition implements Condition {
  kind: ConditionKind;
  children: ReadonlyArray<Condition>;

  constructor(operand: Condition) {
    this.kind = ConditionKind.NotOperator;
    this.children = [operand];
  }

  evaluate(entry: vle.Entry) {
    return !this.children[0].evaluate(entry);
  }
}

class AndCondition implements Condition {
  kind: ConditionKind;
  children: ReadonlyArray<Condition>;

  private first: Condition;
  private rest: ReadonlyArray<Condition>;

  constructor(first: Condition, ...rest: Condition[]) {
    this.kind = ConditionKind.AndOperator;
    this.children = [first, ...rest];
    this.first = first;
    this.rest = [...rest];
  }

  evaluate(entry: vle.Entry) {
    return R.reduceWhile(
      (acc: boolean, _: Condition) => acc,
      (acc: boolean, elem: Condition) => acc && elem.evaluate(entry),
      this.first.evaluate(entry),
      this.rest
    );
  }
}

class OrCondition implements Condition {
  kind: ConditionKind;
  children: ReadonlyArray<Condition>;

  private first: Condition;
  private rest: ReadonlyArray<Condition>;

  constructor(first: Condition, ...rest: Condition[]) {
    this.kind = ConditionKind.OrOperator;
    this.children = [first, ...rest];
    this.first = first;
    this.rest = [...rest];
  }

  evaluate(entry: vle.Entry) {
    return R.reduceWhile(
      (acc: boolean, _: Condition) => !acc,
      (acc: boolean, elem: Condition) => acc || elem.evaluate(entry),
      this.first.evaluate(entry),
      this.rest
    );
  }
}

class EntryCondition implements Condition {
  kind: ConditionKind;
  children: ReadonlyArray<Condition>;

  private entryKind: vle.EntryKind;

  constructor(entryKind: vle.EntryKind) {
    this.kind = ConditionKind.EntryKind;
    this.children = [];
    this.entryKind = entryKind;
  }

  evaluate(entry: vle.Entry) {
    return entry.kind === this.entryKind;
  }
}

class CategoryCondition implements Condition {
  kind: ConditionKind;
  children: ReadonlyArray<Condition>;

  private category: vle.Category;

  constructor(category: vle.Category) {
    this.kind = ConditionKind.Category;
    this.children = [];
    this.category = category;
  }

  evaluate(entry: vle.Entry) {
    return entry.category === this.category;
  }
}

class OverFrameTimeWarningCondition implements Condition {
  kind: ConditionKind;
  children: ReadonlyArray<Condition>;

  constructor() {
    this.kind = ConditionKind.OverFrameTimeWarning;
    this.children = [];
  }

  evaluate(entry: vle.Entry) {
    return (
      entry.category === vle.Category.System &&
      entry.message.startsWith('frame: script not return')
    );
  }
}

class FieldTextCondition implements Condition {
  kind: ConditionKind;
  children: ReadonlyArray<Condition>;
  evaluate: (entry: vle.Entry) => boolean;

  constructor(kind: ConditionKind, evaluate: (entry: vle.Entry) => boolean) {
    this.kind = kind;
    this.children = [];
    this.evaluate = evaluate;
  }
}

const conditionKindIsAny = R.compose(
  R.equals<ConditionKind>(ConditionKind.Any),
  R.view(R.lensProp<Condition, 'kind'>('kind'))
);

const conditionKindIsNotAny = R.compose(R.not, conditionKindIsAny);

export const anyCondition: Condition = new AnyCondition();

export const overFrameTimeWarningCondition: Condition =
  new OverFrameTimeWarningCondition();

export const makeNotCondition = (operand: Condition): Condition =>
  operand instanceof NotCondition
    ? operand.children[0]
    : new NotCondition(operand);

export const makeAndCondition = (
  first: Condition,
  ...rest: Condition[]
): Condition => {
  const ls = R.chain(
    (elem) => (elem instanceof AndCondition ? elem.children : [elem]),
    [first, ...rest]
  ).filter(conditionKindIsNotAny);

  const hd = R.head(ls);
  return hd === undefined ? anyCondition : new AndCondition(hd, ...R.tail(ls));
};

export const makeOrCondition = (
  first: Condition,
  ...rest: Condition[]
): Condition => {
  const ls = R.chain(
    (elem) => (elem instanceof OrCondition ? elem.children : [elem]),
    [first, ...rest]
  );

  return R.any(conditionKindIsAny, ls)
    ? anyCondition
    : new OrCondition(first, ...rest);
};

export const makeEntryCondition = (entryKind: vle.EntryKind): Condition =>
  new EntryCondition(entryKind);

export const makeCategoryCondition = (category: vle.Category): Condition =>
  new CategoryCondition(category);

const makeFieldEqualConditionM = (
  mapper: TextMapper,
  fieldKeys: ReadonlyArray<vle.FieldKey>,
  search: string
): Condition => {
  const ms = mapper(search);
  const tester = (str: string) => str === ms;
  return new FieldTextCondition(
    ConditionKind.FieldEqual,
    fieldTextEvaluator(R.compose(tester, mapper), fieldKeys)
  );
};

export const makeFieldEqualCondition = (
  fieldKeys: ReadonlyArray<vle.FieldKey>,
  search: string
): Condition => makeFieldEqualConditionM(R.toLower, fieldKeys, search);

export const makeCaseSensitiveFieldEqualCondition = (
  fieldKeys: ReadonlyArray<vle.FieldKey>,
  search: string
): Condition => makeFieldEqualConditionM(R.identity, fieldKeys, search);

const makeFieldIncludeConditionM = (
  mapper: TextMapper,
  fieldKeys: ReadonlyArray<vle.FieldKey>,
  search: string
): Condition => {
  const ms = mapper(search);
  const tester = (str: string) => str.includes(ms);
  return new FieldTextCondition(
    ConditionKind.FieldInclude,
    fieldTextEvaluator(R.compose(tester, mapper), fieldKeys)
  );
};

export const makeFieldIncludeCondition = (
  fieldKeys: ReadonlyArray<vle.FieldKey>,
  search: string
): Condition => makeFieldIncludeConditionM(R.toLower, fieldKeys, search);

export const makeCaseSensitiveFieldIncludeCondition = (
  fieldKeys: ReadonlyArray<vle.FieldKey>,
  search: string
): Condition => makeFieldIncludeConditionM(R.identity, fieldKeys, search);

export const makeFieldMatchCondition = (
  fieldKeys: ReadonlyArray<vle.FieldKey>,
  pattern: RegExp
): Condition => {
  const tester = (str: string) => pattern.test(str);
  return new FieldTextCondition(
    ConditionKind.FieldMatch,
    fieldTextEvaluator(tester, fieldKeys)
  );
};

const makeFallbackFieldMatchConditionM = (
  mapper: TextMapper,
  fieldKeys: ReadonlyArray<vle.FieldKey>,
  patternText: string,
  patternFlags: string
): Condition => {
  try {
    const pattern = new RegExp(patternText, patternFlags);
    return makeFieldMatchCondition(fieldKeys, pattern);
  } catch (_) {
    return makeFieldIncludeConditionM(mapper, fieldKeys, patternText);
  }
};

export const makeFallbackFieldMatchCondition = (
  fieldKeys: ReadonlyArray<vle.FieldKey>,
  patternText: string
): Condition =>
  makeFallbackFieldMatchConditionM(R.toLower, fieldKeys, patternText, 'i');

export const makeCaseSensitiveFallbackFieldMatchCondition = (
  fieldKeys: ReadonlyArray<vle.FieldKey>,
  patternText: string
): Condition =>
  makeFallbackFieldMatchConditionM(R.identity, fieldKeys, patternText, '');
