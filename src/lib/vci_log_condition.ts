import * as R from 'ramda';

import * as vle from './vci_log_entry';

export const ConditionKind = {
  Any: 'ANY',
  Never: 'NEVER',
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

export type ConditionKind = (typeof ConditionKind)[keyof typeof ConditionKind];

export interface Condition {
  readonly kind: ConditionKind;
  readonly children: ReadonlyArray<Condition>;
  readonly evaluate: (entry: vle.Entry) => boolean;
}

type TextMapper = (str: string) => string;

type TextTester = (str: string) => boolean;

const fieldTextEvaluator = (
  fieldTester: TextTester,
  fieldKeys: ReadonlyArray<vle.FieldKey>,
) => {
  return (entry: vle.Entry) =>
    R.any((key) => {
      const fieldVal = vle.fieldText(key, entry);
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

class NeverCondition implements Condition {
  kind: ConditionKind;
  children: ReadonlyArray<Condition>;

  constructor() {
    this.kind = ConditionKind.Never;
    this.children = [];
  }

  evaluate(_entry: vle.Entry) {
    return false;
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
      this.rest,
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
      this.rest,
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
  R.view(R.lensProp<Condition, 'kind'>('kind')),
);

const conditionKindIsNotAny = R.compose(R.not, conditionKindIsAny);

const conditionKindIsNever = R.compose(
  R.equals<ConditionKind>(ConditionKind.Never),
  R.view(R.lensProp<Condition, 'kind'>('kind')),
);

const conditionKindIsNotNever = R.compose(R.not, conditionKindIsNever);

const staticAnyCondition = new AnyCondition();

export const anyCondition = (): Condition => staticAnyCondition;

const staticNeverCondition = new NeverCondition();

export const neverCondition = (): Condition => staticNeverCondition;

const staticOverFrameTimeWarningCondition = new OverFrameTimeWarningCondition();

export const overFrameTimeWarningCondition = (): Condition =>
  staticOverFrameTimeWarningCondition;

export const notCondition = (operand: Condition): Condition =>
  operand instanceof NotCondition && operand.children.length == 1
    ? operand.children[0]
    : operand instanceof AnyCondition
    ? neverCondition()
    : operand instanceof NeverCondition
    ? anyCondition()
    : new NotCondition(operand);

export const andCondition = (
  first: Condition,
  ...rest: Condition[]
): Condition => {
  const ls = R.chain(
    (elem) => (elem instanceof AndCondition ? elem.children : [elem]),
    [first, ...rest],
  ).filter(conditionKindIsNotAny);

  if (R.any(conditionKindIsNever, ls)) {
    return neverCondition();
  } else {
    const hd = R.head(ls);
    if (hd === undefined) {
      return anyCondition();
    } else {
      const tl = R.tail(ls);
      return R.isEmpty(tl) ? hd : new AndCondition(hd, ...tl);
    }
  }
};

export const orCondition = (
  first: Condition,
  ...rest: Condition[]
): Condition => {
  const ls = R.chain(
    (elem) => (elem instanceof OrCondition ? elem.children : [elem]),
    [first, ...rest],
  ).filter(conditionKindIsNotNever);

  if (R.any(conditionKindIsAny, ls)) {
    return anyCondition();
  } else {
    const hd = R.head(ls);
    if (hd === undefined) {
      return neverCondition();
    } else {
      const tl = R.tail(ls);
      return R.isEmpty(tl) ? hd : new OrCondition(hd, ...tl);
    }
  }
};

export const entryCondition = (entryKind: vle.EntryKind): Condition =>
  new EntryCondition(entryKind);

export const categoryCondition = (category: vle.Category): Condition =>
  new CategoryCondition(category);

const fieldEqualConditionM = (
  mapper: TextMapper,
  fieldKeys: ReadonlyArray<vle.FieldKey>,
  search: string,
): Condition => {
  const ms = mapper(search);
  const tester = (str: string) => str === ms;
  return new FieldTextCondition(
    ConditionKind.FieldEqual,
    fieldTextEvaluator(R.compose(tester, mapper), fieldKeys),
  );
};

export const fieldEqualCondition = (
  fieldKeys: ReadonlyArray<vle.FieldKey>,
  search: string,
): Condition => fieldEqualConditionM(R.toLower, fieldKeys, search);

export const caseSensitiveFieldEqualCondition = (
  fieldKeys: ReadonlyArray<vle.FieldKey>,
  search: string,
): Condition => fieldEqualConditionM(R.identity, fieldKeys, search);

const fieldIncludeConditionM = (
  mapper: TextMapper,
  fieldKeys: ReadonlyArray<vle.FieldKey>,
  search: string,
): Condition => {
  const ms = mapper(search);
  const tester = (str: string) => str.includes(ms);
  return new FieldTextCondition(
    ConditionKind.FieldInclude,
    fieldTextEvaluator(R.compose(tester, mapper), fieldKeys),
  );
};

export const fieldIncludeCondition = (
  fieldKeys: ReadonlyArray<vle.FieldKey>,
  search: string,
): Condition => fieldIncludeConditionM(R.toLower, fieldKeys, search);

export const caseSensitiveFieldIncludeCondition = (
  fieldKeys: ReadonlyArray<vle.FieldKey>,
  search: string,
): Condition => fieldIncludeConditionM(R.identity, fieldKeys, search);

export const fieldMatchCondition = (
  fieldKeys: ReadonlyArray<vle.FieldKey>,
  pattern: RegExp,
): Condition => {
  const tester = (str: string) => pattern.test(str);
  return new FieldTextCondition(
    ConditionKind.FieldMatch,
    fieldTextEvaluator(tester, fieldKeys),
  );
};

const fallbackFieldMatchConditionM = (
  mapper: TextMapper,
  fieldKeys: ReadonlyArray<vle.FieldKey>,
  patternText: string,
  patternFlags: string,
): Condition => {
  try {
    const pattern = new RegExp(patternText, patternFlags);
    return fieldMatchCondition(fieldKeys, pattern);
  } catch (_) {
    return fieldIncludeConditionM(mapper, fieldKeys, patternText);
  }
};

export const fallbackFieldMatchCondition = (
  fieldKeys: ReadonlyArray<vle.FieldKey>,
  patternText: string,
): Condition =>
  fallbackFieldMatchConditionM(R.toLower, fieldKeys, patternText, 'i');

export const caseSensitiveFallbackFieldMatchCondition = (
  fieldKeys: ReadonlyArray<vle.FieldKey>,
  patternText: string,
): Condition =>
  fallbackFieldMatchConditionM(R.identity, fieldKeys, patternText, '');
