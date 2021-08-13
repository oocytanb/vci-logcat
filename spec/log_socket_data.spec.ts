import { assert } from 'chai';

import msgpack from 'msgpack-lite';

import {
  EntryKind,
  Category,
  LogLevel,
  EntryMessage,
} from '../src/lib/vci_log_entry';

import {
  SocketRequestKind,
  makeConnectRequest,
  makeDisconnectRequest,
  parseLogEntry,
} from '../src/lib/vci_log_socket_data';

describe('log_socket_data', () => {
  const codec = msgpack.createCodec({ uint8array: true });
  const codec_options = { codec: codec };

  it('makeConnectRequest', () => {
    const r = makeConnectRequest('192.168.0.1');
    assert.strictEqual(r.kind, SocketRequestKind.Connect);
    assert.strictEqual(r.url, '192.168.0.1');
  });

  it('makeDisconnectRequest', () => {
    const r = makeDisconnectRequest();
    assert.strictEqual(r.kind, SocketRequestKind.Disconnect);
  });

  it('parseLogEntry unsupported', () => {
    const e = parseLogEntry(415);

    assert.strictEqual(e.kind, EntryKind.Notification);
    assert.strictEqual(e.category, Category.Unknown);
    assert.strictEqual(e.logLevel, LogLevel.Error);
    assert.strictEqual(
      e.message,
      `${EntryMessage.UnsupportedDataFormat} number`
    );
  });

  it('parseLogEntry string', () => {
    const e = parseLogEntry('baz_str_log');

    assert.strictEqual(e.kind, EntryKind.Notification);
    assert.strictEqual(e.category, Category.Unknown);
    assert.strictEqual(e.logLevel, LogLevel.Error);
    assert.strictEqual(e.message, 'baz_str_log');
  });

  it('parseLogEntry ArrayBuffer', () => {
    const d = msgpack.encode(
      [
        2,
        'logger',
        [
          {
            LogLevel: 'Trace',
            Category: Category.Item_Print,
            Message: 'foo_vci',
          },
        ],
      ],
      codec_options
    );

    const e = parseLogEntry(d);

    assert.strictEqual(e.kind, EntryKind.Logger);
    assert.strictEqual(e.category, Category.Item_Print);
    assert.strictEqual(e.logLevel, LogLevel.Trace);
    assert.strictEqual(e.message, 'foo_vci');

    assert.deepStrictEqual(parseLogEntry(d.buffer), e);
  });

  it('parseLogEntry error', () => {
    const e = parseLogEntry(new Uint8Array([147]));

    assert.strictEqual(e.kind, EntryKind.Notification);
    assert.strictEqual(e.category, Category.Unknown);
    assert.strictEqual(e.logLevel, LogLevel.Error);
    assert.isTrue(e.message.startsWith(EntryMessage.UnsupportedDataFormat));
  });
});
