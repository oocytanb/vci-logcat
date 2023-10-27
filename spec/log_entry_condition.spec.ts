import { assert } from 'chai';

import {
  EntryKind,
  FieldKey,
  Category,
  make,
  fromText,
} from '../src/lib/vci_log_entry';

import {
  ConditionKind,
  Condition,
  anyCondition,
  neverCondition,
  overFrameTimeWarningCondition,
  notCondition,
  andCondition,
  orCondition,
  entryCondition,
  categoryCondition,
  fieldEqualCondition,
  caseSensitiveFieldEqualCondition,
  fieldIncludeCondition,
  caseSensitiveFieldIncludeCondition,
  fieldMatchCondition,
  fallbackFieldMatchCondition,
  caseSensitiveFallbackFieldMatchCondition,
} from '../src/lib/vci_log_condition';

describe('vle condition', () => {
  type CkNode = Readonly<{
    kind: ConditionKind;
    children: ReadonlyArray<CkNode>;
  }>;

  const ckNode = (c: Condition): CkNode => ({
    kind: c.kind,
    children: c.children.map(ckNode),
  });

  it('any', () => {
    const c = anyCondition();
    assert.strictEqual(c.kind, ConditionKind.Any);
    assert.isEmpty(c.children);
    assert.isTrue(c.evaluate(fromText(EntryKind.Unknown, -20, '')));
    assert.isTrue(c.evaluate(make(EntryKind.Text, {})));
  });

  it('never', () => {
    const c = neverCondition();
    assert.strictEqual(c.kind, ConditionKind.Never);
    assert.isEmpty(c.children);
    assert.isFalse(c.evaluate(fromText(EntryKind.Unknown, -20, '')));
    assert.isFalse(c.evaluate(make(EntryKind.Text, {})));
  });

  it('overFrameTimeWarning', () => {
    const c = overFrameTimeWarningCondition();
    assert.strictEqual(c.kind, ConditionKind.OverFrameTimeWarning);
    assert.isEmpty(c.children);

    assert.isTrue(
      c.evaluate(
        make(EntryKind.Logger, {
          Category: Category.System,
          Message: 'frame: script not return',
        }),
      ),
    );

    assert.isFalse(
      c.evaluate(
        make(EntryKind.Logger, {
          Category: Category.Item_Print,
          Message: 'frame: script not return',
        }),
      ),
    );

    assert.isFalse(
      c.evaluate(
        make(EntryKind.Logger, {
          Category: Category.System,
          Message: 'frame',
        }),
      ),
    );
  });

  it('not', () => {
    const c = notCondition(entryCondition(EntryKind.Text));

    assert.deepStrictEqual(ckNode(c), {
      kind: ConditionKind.NotOperator,
      children: [{ kind: ConditionKind.EntryKind, children: [] }],
    });

    assert.isFalse(c.evaluate(fromText(EntryKind.Text, -20, '')));
    assert.isTrue(c.evaluate(fromText(EntryKind.Notification, -20, '')));
  });

  it('not not', () => {
    const c = notCondition(notCondition(entryCondition(EntryKind.Text)));

    assert.deepStrictEqual(ckNode(c), {
      kind: ConditionKind.EntryKind,
      children: [],
    });

    assert.isTrue(c.evaluate(fromText(EntryKind.Text, -20, '')));
    assert.isFalse(c.evaluate(fromText(EntryKind.Notification, -20, '')));
  });

  it('not any', () => {
    const c = notCondition(anyCondition());

    assert.deepStrictEqual(ckNode(c), {
      kind: ConditionKind.Never,
      children: [],
    });
  });

  it('not not any', () => {
    const c = notCondition(notCondition(anyCondition()));

    assert.deepStrictEqual(ckNode(c), {
      kind: ConditionKind.Any,
      children: [],
    });
  });

  it('not never', () => {
    const c = notCondition(neverCondition());

    assert.deepStrictEqual(ckNode(c), {
      kind: ConditionKind.Any,
      children: [],
    });
  });

  it('not not never', () => {
    const c = notCondition(notCondition(neverCondition()));

    assert.deepStrictEqual(ckNode(c), {
      kind: ConditionKind.Never,
      children: [],
    });
  });

  it('and', () => {
    const c = andCondition(
      entryCondition(EntryKind.Text),
      categoryCondition(Category.Unknown),
      anyCondition(),
    );

    assert.deepStrictEqual(ckNode(c), {
      kind: ConditionKind.AndOperator,
      children: [
        {
          kind: ConditionKind.EntryKind,
          children: [],
        },
        {
          kind: ConditionKind.Category,
          children: [],
        },
      ],
    });

    assert.isTrue(c.evaluate(make(EntryKind.Text)));
    assert.isFalse(
      c.evaluate(make(EntryKind.Text, { Category: Category.Item_Print })),
    );
    assert.isFalse(
      c.evaluate(make(EntryKind.Logger, { Category: Category.Unknown })),
    );
  });

  it('and any', () => {
    const c = andCondition(
      anyCondition(),
      entryCondition(EntryKind.Text),
      anyCondition(),
    );

    assert.deepStrictEqual(ckNode(c), {
      kind: ConditionKind.EntryKind,
      children: [],
    });
  });

  it('and any only', () => {
    const c = andCondition(anyCondition(), anyCondition());

    assert.deepStrictEqual(ckNode(c), {
      kind: ConditionKind.Any,
      children: [],
    });
  });

  it('and never', () => {
    const c = andCondition(entryCondition(EntryKind.Text), neverCondition());

    assert.deepStrictEqual(ckNode(c), {
      kind: ConditionKind.Never,
      children: [],
    });
  });

  it('and and', () => {
    const c = andCondition(
      entryCondition(EntryKind.Text),
      andCondition(
        categoryCondition(Category.Unknown),
        notCondition(entryCondition(EntryKind.Notification)),
      ),
      anyCondition(),
    );

    assert.deepStrictEqual(ckNode(c), {
      kind: ConditionKind.AndOperator,
      children: [
        {
          kind: ConditionKind.EntryKind,
          children: [],
        },
        {
          kind: ConditionKind.Category,
          children: [],
        },
        {
          kind: ConditionKind.NotOperator,
          children: [
            {
              kind: ConditionKind.EntryKind,
              children: [],
            },
          ],
        },
      ],
    });

    assert.isTrue(c.evaluate(make(EntryKind.Text)));
    assert.isFalse(
      c.evaluate(make(EntryKind.Text, { Category: Category.Item_Print })),
    );
  });

  it('or', () => {
    const c = orCondition(
      entryCondition(EntryKind.Text),
      categoryCondition(Category.Unknown),
      neverCondition(),
    );

    assert.deepStrictEqual(ckNode(c), {
      kind: ConditionKind.OrOperator,
      children: [
        {
          kind: ConditionKind.EntryKind,
          children: [],
        },
        {
          kind: ConditionKind.Category,
          children: [],
        },
      ],
    });

    assert.isTrue(c.evaluate(make(EntryKind.Text)));
    assert.isTrue(
      c.evaluate(make(EntryKind.Text, { Category: Category.Item_Print })),
    );
    assert.isTrue(
      c.evaluate(make(EntryKind.Logger, { Category: Category.Unknown })),
    );
  });

  it('or any', () => {
    const c = orCondition(
      anyCondition(),
      entryCondition(EntryKind.Text),
      anyCondition(),
    );

    assert.deepStrictEqual(ckNode(c), {
      kind: ConditionKind.Any,
      children: [],
    });
  });

  it('or never', () => {
    const c = orCondition(entryCondition(EntryKind.Text), neverCondition());

    assert.deepStrictEqual(ckNode(c), {
      kind: ConditionKind.EntryKind,
      children: [],
    });
  });

  it('or never only', () => {
    const c = orCondition(neverCondition(), neverCondition());

    assert.deepStrictEqual(ckNode(c), {
      kind: ConditionKind.Never,
      children: [],
    });
  });

  it('or or', () => {
    const c = orCondition(
      entryCondition(EntryKind.Text),
      orCondition(
        categoryCondition(Category.Unknown),
        notCondition(entryCondition(EntryKind.Notification)),
      ),
      neverCondition(),
    );

    assert.deepStrictEqual(ckNode(c), {
      kind: ConditionKind.OrOperator,
      children: [
        {
          kind: ConditionKind.EntryKind,
          children: [],
        },
        {
          kind: ConditionKind.Category,
          children: [],
        },
        {
          kind: ConditionKind.NotOperator,
          children: [
            {
              kind: ConditionKind.EntryKind,
              children: [],
            },
          ],
        },
      ],
    });

    assert.isTrue(c.evaluate(make(EntryKind.Text)));
    assert.isTrue(
      c.evaluate(make(EntryKind.Text, { Category: Category.Item_Print })),
    );
    assert.isFalse(
      c.evaluate(
        make(EntryKind.Notification, { Category: Category.Item_Print }),
      ),
    );
    assert.isTrue(
      c.evaluate(make(EntryKind.Notification, { Category: Category.Unknown })),
    );
  });

  it('fieldEqual', () => {
    const c = fieldEqualCondition(
      [
        FieldKey.LogLevel,
        FieldKey.Category,
        FieldKey.Message,
        FieldKey.CallerFile,
      ],
      'debug',
    );

    assert.isTrue(c.evaluate(make(EntryKind.Logger)));

    assert.isTrue(
      c.evaluate(
        make(EntryKind.Logger, {
          LogLevel: 'Fatal',
          CallerFile: 'DEBUG',
        }),
      ),
    );

    assert.isFalse(
      c.evaluate(
        make(EntryKind.Logger, {
          LogLevel: 'Fatal',
          Message: 'debug baz',
          Item: 'debug',
        }),
      ),
    );

    assert.isTrue(
      c.evaluate(
        make(EntryKind.Logger, {
          LogLevel: 'Fatal',
          Category: ' debug ',
          Message: 'debug baz',
          CallerFile: 'DEBUG',
          Item: 'debug',
        }),
      ),
    );
  });

  it('caseSensitiveFieldEqual', () => {
    const c = caseSensitiveFieldEqualCondition(
      [
        FieldKey.LogLevel,
        FieldKey.Category,
        FieldKey.Message,
        FieldKey.CallerFile,
      ],
      'debug',
    );

    assert.isFalse(c.evaluate(make(EntryKind.Logger)));

    assert.isTrue(
      c.evaluate(
        make(EntryKind.Logger, {
          LogLevel: 'Fatal',
          Message: 'debug',
        }),
      ),
    );

    assert.isFalse(
      c.evaluate(
        make(EntryKind.Logger, {
          LogLevel: 'Fatal',
          CallerFile: 'DEBUG',
        }),
      ),
    );

    assert.isFalse(
      c.evaluate(
        make(EntryKind.Logger, {
          LogLevel: 'Fatal',
          Message: 'debug baz',
          Item: 'debug',
        }),
      ),
    );

    assert.isFalse(
      c.evaluate(
        make(EntryKind.Logger, {
          LogLevel: 'Fatal',
          Category: ' debug ',
          Message: 'debug baz',
          CallerFile: 'DEBUG',
          Item: 'debug',
        }),
      ),
    );
  });

  it('fieldInclude', () => {
    const c = fieldIncludeCondition(
      [
        FieldKey.LogLevel,
        FieldKey.Category,
        FieldKey.Message,
        FieldKey.CallerFile,
      ],
      'debug',
    );

    assert.isTrue(c.evaluate(make(EntryKind.Logger)));

    assert.isTrue(
      c.evaluate(
        make(EntryKind.Logger, {
          LogLevel: 'Fatal',
          CallerFile: 'fooDEBUGbaz',
        }),
      ),
    );

    assert.isFalse(
      c.evaluate(
        make(EntryKind.Logger, {
          LogLevel: 'Fatal',
          Message: 'deaz',
          Item: 'debug',
        }),
      ),
    );
  });

  it('caseSensitiveFieldInclude', () => {
    const c = caseSensitiveFieldIncludeCondition(
      [
        FieldKey.LogLevel,
        FieldKey.Category,
        FieldKey.Message,
        FieldKey.CallerFile,
      ],
      'debug',
    );

    assert.isFalse(c.evaluate(make(EntryKind.Logger)));

    assert.isFalse(
      c.evaluate(
        make(EntryKind.Logger, {
          LogLevel: 'Fatal',
          CallerFile: 'fooDEBUGbaz',
        }),
      ),
    );

    assert.isTrue(
      c.evaluate(
        make(EntryKind.Logger, {
          LogLevel: 'Fatal',
          Message: 'foodebugbaz',
        }),
      ),
    );

    assert.isFalse(
      c.evaluate(
        make(EntryKind.Logger, {
          LogLevel: 'Fatal',
          Message: 'deaz',
          Item: 'debug',
        }),
      ),
    );
  });

  it('fieldMatch', () => {
    const c = fieldMatchCondition(
      [
        FieldKey.LogLevel,
        FieldKey.Category,
        FieldKey.Message,
        FieldKey.CallerFile,
      ],
      /debug$/,
    );

    assert.isFalse(c.evaluate(make(EntryKind.Logger)));

    assert.isFalse(
      c.evaluate(
        make(EntryKind.Logger, {
          LogLevel: 'Fatal',
          CallerFile: 'fooDEBUG',
        }),
      ),
    );

    assert.isTrue(
      c.evaluate(
        make(EntryKind.Logger, {
          LogLevel: 'Fatal',
          Message: 'FOOdebug',
        }),
      ),
    );

    assert.isFalse(
      c.evaluate(
        make(EntryKind.Logger, {
          LogLevel: 'Fatal',
          Message: 'debug ',
          Item: 'debug',
        }),
      ),
    );
  });

  it('fallbackFieldMatch', () => {
    const c = fallbackFieldMatchCondition(
      [
        FieldKey.LogLevel,
        FieldKey.Category,
        FieldKey.Message,
        FieldKey.CallerFile,
      ],
      'debug$',
    );

    assert.isTrue(c.evaluate(make(EntryKind.Logger)));

    assert.isTrue(
      c.evaluate(
        make(EntryKind.Logger, {
          LogLevel: 'Fatal',
          CallerFile: 'fooDEBUG',
        }),
      ),
    );

    assert.isFalse(
      c.evaluate(
        make(EntryKind.Logger, {
          LogLevel: 'Fatal',
          Message: 'debug ',
          Item: 'debug',
        }),
      ),
    );
  });

  it('fallbackFieldMatch invalid pattern', () => {
    const c = fallbackFieldMatchCondition(
      [
        FieldKey.LogLevel,
        FieldKey.Category,
        FieldKey.Message,
        FieldKey.CallerFile,
      ],
      '*pt*',
    );

    assert.isFalse(c.evaluate(make(EntryKind.Logger)));

    assert.isTrue(
      c.evaluate(
        make(EntryKind.Logger, {
          LogLevel: 'Fatal',
          Message: 'foo *PT* bar',
        }),
      ),
    );

    assert.isFalse(
      c.evaluate(
        make(EntryKind.Logger, {
          LogLevel: 'Fatal',
          Message: '*PTT*',
        }),
      ),
    );
  });

  it('caseSensitiveFallbackFieldMatch', () => {
    const c = caseSensitiveFallbackFieldMatchCondition(
      [
        FieldKey.LogLevel,
        FieldKey.Category,
        FieldKey.Message,
        FieldKey.CallerFile,
      ],
      'debug$',
    );

    assert.isFalse(c.evaluate(make(EntryKind.Logger)));

    assert.isFalse(
      c.evaluate(
        make(EntryKind.Logger, {
          LogLevel: 'Fatal',
          CallerFile: 'fooDEBUG',
        }),
      ),
    );

    assert.isTrue(
      c.evaluate(
        make(EntryKind.Logger, {
          LogLevel: 'Fatal',
          Message: 'FOOdebug',
        }),
      ),
    );

    assert.isFalse(
      c.evaluate(
        make(EntryKind.Logger, {
          LogLevel: 'Fatal',
          Message: 'debug ',
          Item: 'debug',
        }),
      ),
    );
  });

  it('caseSensitiveFallbackFieldMatch invalid pattern', () => {
    const c = caseSensitiveFallbackFieldMatchCondition(
      [
        FieldKey.LogLevel,
        FieldKey.Category,
        FieldKey.Message,
        FieldKey.CallerFile,
      ],
      '*pt*',
    );

    assert.isFalse(c.evaluate(make(EntryKind.Logger)));

    assert.isTrue(
      c.evaluate(
        make(EntryKind.Logger, {
          LogLevel: 'Fatal',
          Message: 'foo *pt* bar',
        }),
      ),
    );

    assert.isFalse(
      c.evaluate(
        make(EntryKind.Logger, {
          LogLevel: 'Fatal',
          Message: 'foo *PT* bar',
        }),
      ),
    );

    assert.isFalse(
      c.evaluate(
        make(EntryKind.Logger, {
          LogLevel: 'Fatal',
          Message: '*ptt*',
        }),
      ),
    );
  });
});
