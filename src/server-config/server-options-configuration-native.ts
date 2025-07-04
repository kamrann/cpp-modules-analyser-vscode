/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import { ServerOptions, TransportKind } from 'vscode-languageclient/node';
import { EnvOverrides } from './server-config-env';

export function determineServerOptionsNative(
  context: vscode.ExtensionContext,
  channel: vscode.OutputChannel,
  nativeServerLocation: string,
  envOverrides: EnvOverrides): ServerOptions {
  const commonArgs: string[] = [];

  if (envOverrides.toolchainRoot) {
    commonArgs.push(`--toolchain-root="${envOverrides.toolchainRoot}"`);
  }
  if (envOverrides.dumpTrace) {
    commonArgs.push('--dump-trace');
  }

  const nativeArgs = [];

  if (envOverrides.waitDebugger) {
    nativeArgs.push(`--wait-debugger=${envOverrides.waitDebugger}`);
  }

  return {
    run: { command: nativeServerLocation, transport: TransportKind.stdio },
    debug: {
      command: nativeServerLocation,
      args: [...commonArgs, ...nativeArgs],
      transport: TransportKind.stdio,
    }
  };
}
