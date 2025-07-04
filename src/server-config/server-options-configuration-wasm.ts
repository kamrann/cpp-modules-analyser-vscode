/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import { Wasm, ProcessOptions } from '@vscode/wasm-wasi/v1';
//import { WasmContext, Memory } from '@vscode/wasm-component-model';
import { createStdioOptions, startServer } from '@vscode/wasm-wasi-lsp';
import { EnvOverrides } from './server-config-env';

export function determineServerOptionsWasm(
  context: vscode.ExtensionContext,
  channel: vscode.OutputChannel,
  envOverrides: EnvOverrides) {
  const commonArgs: string[] = [];

  if (envOverrides.toolchainRoot) {
    commonArgs.push(`--toolchain-root="${envOverrides.toolchainRoot}"`);
  } else {
    commonArgs.push(`--toolchain-root="/resources"`); // @todo: look into why this was added. maybe web-related?
  }
  if (envOverrides.dumpTrace) {
    commonArgs.push('--dump-trace');
  }

  const defaultWasiModulePath = vscode.Uri.joinPath(context.extensionUri, 'dist', 'wasm', 'modules-lsp.wasi');
  const wasiModulePath = process.env.CPP_MODULES_ANALYSER_WASI_PATH !== undefined ? vscode.Uri.file(process.env.CPP_MODULES_ANALYSER_WASI_PATH) : defaultWasiModulePath;

  return async () => {
    const options: ProcessOptions = {
      stdio: createStdioOptions(),
      mountPoints: [
        // A descriptor signaling that the workspace folder is mapped as `/workspace` or in case of a multi-root workspace each folder is mapped as `/workspaces/folder-name`.
        // @note: this appears to not work when opening local folders in vscode for the web...
        // (they generate uris of the form 'file:///folder-name', which differs from desktop/github, but neither
        // /workspace(s) not /folder-name appear to be mounted).
        { kind: 'workspaceFolder' },
        // Feels like should be using this but don't understand expectation of `path`. Keeps throwing file not found errors relating to ...\.dir.json
        //{ kind: 'extensionLocation', extension: context, path: '/', mountPoint: '/funk' },
        { kind: 'vscodeFileSystem', uri: vscode.Uri.joinPath(context.extensionUri, 'resources'), mountPoint: '/resources' },
      ],
      args: [...commonArgs]
    };

    const bits = await vscode.workspace.fs.readFile(wasiModulePath);
    const module = await WebAssembly.compile(bits);

    const wasm: Wasm = await Wasm.load();
    const process = await wasm.createProcess('modules-lsp-server', module, { initial: 160, maximum: 160, shared: true }, options);

    const decoder = new TextDecoder('utf-8');
    const buffer: string[] = [];
    process.stderr!.onData((data) => {
      const decoded = decoder.decode(data);
      const newline = decoded.indexOf("\n");
      if (newline !== -1) {
        buffer.push(decoded.substring(0, newline + 1));
        channel.append(buffer.join(""));
        buffer.length = 0;
        buffer.push(decoded.substring(newline + 1));
      } else {
        buffer.push(decoded);
      }
    });

    return startServer(process);
  };
}
