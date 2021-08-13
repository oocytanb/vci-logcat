import xs, { Listener, Subscription } from 'xstream';
import { adapt } from '@cycle/run/lib/adapt';
import WebSocket from 'isomorphic-ws';

import * as vle from './vci_log_entry';

import {
  SocketMessage,
  SocketRequestKind,
  SocketRequest,
  parseLogEntry,
} from './vci_log_socket_data';

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

export const makeVciLogSocketDriver =
  (): ReturnType<typeof adapt> => (request$: xs<SocketRequest>) => {
    return adapt(model(request$));
  };
