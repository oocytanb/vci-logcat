import { decode } from 'msgpack-lite';

import * as vle from './vci_log_entry';

export const SocketMessage = {
  Prefix: 'socket:',
  Connecting: 'socket:connecting ',
  Connected: 'socket:connected ',
  Disconnected: 'socket:disconnected ',
  Error: 'socket:error ',
} as const;

export const SocketRequestKind = {
  Connect: 'connect',
  Disconnect: 'disconnect',
} as const;

export type SocketRequestKind =
  (typeof SocketRequestKind)[keyof typeof SocketRequestKind];

export type SocketConnectRequest = Readonly<{
  kind: typeof SocketRequestKind.Connect;
  url: string;
}>;

export type SocketDisconnectRequest = Readonly<{
  kind: typeof SocketRequestKind.Disconnect;
}>;

export type SocketRequest = SocketConnectRequest | SocketDisconnectRequest;

export const makeConnectRequest = (url: string): SocketConnectRequest => ({
  kind: SocketRequestKind.Connect,
  url,
});

export const makeDisconnectRequest = (): SocketDisconnectRequest => ({
  kind: SocketRequestKind.Disconnect,
});

export const parseLogEntry2 = (
  data: Uint8Array | ArrayBuffer | unknown,
  idMap: vle.VciIdMap
): [vle.Entry, vle.VciIdMap] => {
  const buffer =
    data instanceof Uint8Array
      ? data
      : ArrayBuffer.isView(data)
      ? new Uint8Array(data.buffer)
      : data instanceof ArrayBuffer
      ? new Uint8Array(data)
      : undefined;

  if (buffer) {
    try {
      const decoded = decode(buffer);
      return vle.fromStructure2(decoded, idMap);
    } catch (err) {
      return [
        vle.fromText(
          vle.EntryKind.Notification,
          vle.LogLevel.Error,
          `${vle.EntryMessage.UnsupportedDataFormat} ${err}`
        ),
        idMap,
      ];
    }
  } else if (typeof data === 'string') {
    return [
      vle.fromText(vle.EntryKind.Notification, vle.LogLevel.Error, data),
      idMap,
    ];
  } else {
    return [
      vle.fromText(
        vle.EntryKind.Notification,
        vle.LogLevel.Error,
        `${vle.EntryMessage.UnsupportedDataFormat} ${typeof data}`
      ),
      idMap,
    ];
  }
};

/**
 * @deprecated Use `parseLogEntry2`
 */
export const parseLogEntry = (data: Uint8Array | ArrayBuffer | unknown) =>
  parseLogEntry2(data, new Map<string, string>())[0];
