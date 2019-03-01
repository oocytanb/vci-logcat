# vci-logcat

[VCI](https://github.com/virtual-cast/VCI) スクリプトのログを、標準出力するためのプログラムです。

**出力した実データをサンプルとして、仕様不明な状態で仮実装しています。仕様が判明したら適宜修正してお使いください。**

[![vci-logcat 紹介動画](https://img.youtube.com/vi/OUk8GqWlCkw/0.jpg)](https://www.youtube.com/watch?v=OUk8GqWlCkw)


## Installation

- [Node.js](https://nodejs.org/) >= 10

```
git clone https://github.com/oocytanb/vci-logcat.git
npm install
```

## Usage

1. `VirtualCast/config.json` に、`websocket_console_port` の指定を追加し、起動します。

    ```
    {
      "niconico":
      {
      },
      "embedded_script": {
        "websocket_console_port": 8080
      }
    }
    ```

2. デフォルトの、 `ws://localhost:8080` に接続し、ログを標準出力します。

    ```
    npm start
    ```

    以下のコマンドと、等価です。
    接続先を指定すれば、任意のサーバーに接続可能です。

    ```
    node ./bin/vci-logcat -c ws://localhost:8080
    ```

## Debugging

[VS Code](https://code.visualstudio.com/) でデバッグする場合、デバッグの構成を開き、`.vscode/launch.json` を以下のように編集します。

```
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "node",
            "request": "launch",
            "name": "Launch Program",
            "program": "${workspaceFolder}/bin/vci-logcat",
            "args": ["-c", "ws://localhost:8080"]
        }
    ]
}
```

## License

MIT License

## Libraries

このプロジェクトは、以下のライブラリーを参照/使用して作成しています。

- [ws](https://github.com/websockets/ws)
- [wscat](https://github.com/websockets/wscat)
- [commander.js](https://github.com/tj/commander.js)
