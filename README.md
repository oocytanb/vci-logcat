# vci-logcat

[VCI](https://github.com/virtual-cast/VCI) スクリプトのログを、標準出力するためのプログラムです。

**※ 出力した実データをサンプルとして、仕様不明な状態で仮実装しています。仕様が判明したら適宜修正してお使いください。**

**※ TypeScript で再実装しました。**

[![vci-logcat 紹介動画](https://img.youtube.com/vi/OUk8GqWlCkw/0.jpg)](https://www.youtube.com/watch?v=OUk8GqWlCkw)

## Installation

- [git](https://git-scm.com/)

- [Node.js](https://nodejs.org/) >= 16

```
git clone https://github.com/oocytanb/vci-logcat.git
cd vci-logcat
npm install
```

## Settings

- Virtual Cast の設定から、WebSocket ロガーをホストするポートを設定します。

    ![vcas-websocket-logger-config](docs/vcas-websocket-logger-config.png)

- `VirtualCast/config.json` を直接編集する場合は、`websocket_console_port` の指定を追加します。

    ```
    {
        "embedded_script": {
            "websocket_console_port": 8080
        }
    }
    ```

## Usage

Virtual Cast スタジオに入室後、本プログラムを実行します。"ws://localhost:8080" に接続し、ログを標準出力します。

```
npm start
```

`vci.state` と `vci.studio.shared` のログを抑制し、かつ "foo" という名前のアイテム名が含まれるログを出力する場合は、
以下のオプションを指定して実行します。

```
npm start -- -s -i "foo"
```

### Options

- **-c \<url\>**

    接続先を指定します。既定値は "ws://localhost:8080" です。

- **-s**

    `vci.state` と `vci.studio.shared` のログを抑制します。

- **-I \<text\>**

    指定したテキストが含まれるログを出力します。
    対象のフィールドは (`Message`, `Item`, `Category`, `LogLevel`) です。

- **-X \<text\>**

    指定したテキストが含まれるログを除外して出力します。
    対象のフィールドは (`Message`, `Item`, `Category`, `LogLevel`) です。

- **-i \<name\>**

    指定したアイテム名が含まれるログを出力します。

- **-x \<name\>**

    指定したアイテム名が含まれるログを除外して出力します。

- **-r**

    正規表現での検索を有効にします。`-I` `-E` `-i` `-e` オプションに作用します。

- **-A**

    `frame: script not return` のようなシステムの警告ログをすべて出力します。

- **--output-system-status**

    システムステータスのログを出力します。

## Debugging

- **このプログラムを利用するだけであれば、このセクションの設定は不要です**

- [VS Code](https://code.visualstudio.com/) でこのプログラムをデバッグする場合、
デバッグの構成を開き、`.vscode/launch.json` を以下のように編集します。

```
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "pwa-node",
            "request": "launch",
            "name": "Launch Program",
            "skipFiles": [
                "<node_internals>/**"
            ],
            "runtimeArgs": ["--nolazy", "-r", "ts-node/register"],
            "program": "${workspaceFolder}/src/node_cli/cli_main.ts",
            "args": ["-c", "ws://localhost:8080"]
        }
    ]
}
```

## License

MIT License

## Libraries

[see dependencies](./package.json)
