import xs, { Listener, Subscription } from 'xstream';
import { adapt } from '@cycle/run/lib/adapt';
import WebSocket from 'isomorphic-ws';
import { decode } from 'msgpack-lite';

import * as vle from './vci_log_entry';

export { xs, vle };

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
  typeof SocketRequestKind[keyof typeof SocketRequestKind];

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

const parseLogEntry = (data: WebSocket.Data): vle.Entry => {
  if (data instanceof ArrayBuffer) {
    try {
      const decoded = decode(new Uint8Array(data));
      return vle.fromStructure(decoded);
    } catch (err) {
      return vle.fromText(
        vle.EntryKind.Notification,
        vle.LogLevel.Error,
        `[Unsupported data format: ${err}]`
      );
    }
  } else if (typeof data === 'string') {
    return vle.fromText(vle.EntryKind.Notification, vle.LogLevel.Error, data);
  } else {
    return vle.fromText(
      vle.EntryKind.Notification,
      vle.LogLevel.Error,
      `[Unsupported data format: ${typeof data}]`
    );
  }
};

const makeSocket = (url: string, listener: Listener<vle.Entry>) => {
  const loggerAddress = /^\w+:\/\/./i.test(url) ? url : `ws://${url}`;

  listener.next(
    vle.fromText(
      vle.EntryKind.Notification,
      vle.LogLevel.Info,
      `${SocketMessage.Connecting}... [${loggerAddress}]`
    )
  );

  let alreadyClosed = false;
  const sock = new WebSocket(loggerAddress);
  sock.binaryType = 'arraybuffer';

  const closeSocket = () => {
    if (!alreadyClosed) {
      alreadyClosed = true;

      listener.next(
        vle.fromText(
          vle.EntryKind.Notification,
          vle.LogLevel.Info,
          SocketMessage.Disconnected
        )
      );

      sock.close();
    }
  };

  sock.onopen = (_event) => {
    listener.next(
      vle.fromText(
        vle.EntryKind.Notification,
        vle.LogLevel.Info,
        SocketMessage.Connected
      )
    );
  };

  sock.onclose = (_event) => {
    closeSocket();
  };

  sock.onerror = (event) => {
    const msg =
      SocketMessage.Error + (event.message ? `[${event.message}]` : '');
    listener.next(
      vle.fromText(vle.EntryKind.Notification, vle.LogLevel.Error, msg)
    );
  };

  sock.onmessage = (event) => {
    listener.next(parseLogEntry(event.data));
  };

  return {
    close: closeSocket,
  };
};

const model = (request$: xs<SocketRequest>) => {
  let so: ReturnType<typeof makeSocket> | null = null;
  let subscription: Subscription | null = null;

  const response$ = xs.create<vle.Entry>({
    start: (listener) => {
      subscription = request$.subscribe({
        next: (request) => {
          switch (request.kind) {
            case SocketRequestKind.Connect:
              if (so) {
                so.close();
                so = null;
              }

              try {
                so = makeSocket(request.url, listener);
              } catch (err) {
                listener.next(
                  vle.fromText(
                    vle.EntryKind.Notification,
                    vle.LogLevel.Error,
                    `${SocketMessage.Error}[${err}]`
                  )
                );
              }
              break;

            case SocketRequestKind.Disconnect:
              if (so) {
                so.close();
                so = null;
              }
              break;

            default:
              throw new TypeError(`invalid request`);
          }
        },
      });
    },

    stop: () => {
      if (so) {
        so.close();
        so = null;
      }

      if (subscription) {
        subscription.unsubscribe();
        subscription = null;
      }
    },
  });

  return response$.remember();
};

export const makeVciLogSocketInputDriver =
  (): ReturnType<typeof adapt> => (request$: xs<SocketRequest>) => {
    return adapt(model(request$));
  };
