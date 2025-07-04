/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient/browser';
import { createUriConverters } from '@vscode/wasm-wasi-lsp';
import { determineServerOptionsWasm } from '../server-config/server-options-configuration-wasm';
import { clientName, initializeClient } from '../lsp-client';
import { getEnvConfigurationOverrides } from '../server-config/server-config-env';

let client: LanguageClient;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const channel = vscode.window.createOutputChannel('C++ Modules Analyser');

  const envOverrides = getEnvConfigurationOverrides();
  const serverOptions: ServerOptions = determineServerOptionsWasm(context, channel, envOverrides);

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ pattern: "**/*.{cpp,cppm,mpp,ipp,cxx,cxxm,mxx,ixx,cc}" }], //hpp,hxx,h  // language: 'c++', 
    outputChannel: channel,
    uriConverters: createUriConverters(),
    initializationOptions: {},
  };

  client = new LanguageClient(clientName, 'C++ Modules Analyser LSP Client', serverOptions, clientOptions);
  initializeClient(context, client);

  try {
    await client.start();
  }
  catch (error) {
    client.error(`Start failed`, error, 'force');
  }
}

export function deactivate() {
  return client.stop();
}
