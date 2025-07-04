/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import { BaseLanguageClient, ResponseError } from 'vscode-languageclient';
import { Utils } from 'vscode-uri';
import { ModulesTreeProvider } from './ui/modules-tree';
import { ModuleUnitImportsTreeProvider } from './ui/module-unit-imports-tree';
import { ModuleUnitImporteesTreeProvider } from './ui/module-unit-importees-tree';
import { ModulesModel } from './modules-model';
import { DelegatingTreeDataProvider } from './ui/tree-provider';

export const clientName = 'cppModulesAnalyser';

export function initializeClient(context: vscode.ExtensionContext, client: BaseLanguageClient) {
  const commandId = (id: string) => {
    return `tokamak.cpp-modules-analyser-vscode.${id}`;
  };

  enum ViewMode {
    modules,
    importers,
    importees,
  }

  const modulesData = new ModulesModel();

  const formatModulesPendingMessage = () => {
    return `${modulesData.isEmpty == false ? "⚠️ Below modules information is out of date. " : ""}Recalculating...`;
  };

  interface ViewModeState {
    displayName: string,
    provider: vscode.TreeDataProvider<vscode.TreeItem>;
    message: string | undefined;
  }

  const viewModes: Record<ViewMode, ViewModeState> = {
    [ViewMode.modules]: { displayName: "Basic Info", provider: new ModulesTreeProvider(modulesData), message: formatModulesPendingMessage() },
    [ViewMode.importers]: { displayName: "Imports", provider: new ModuleUnitImportsTreeProvider(modulesData), message: formatModulesPendingMessage() },
    [ViewMode.importees]: { displayName: "Importees", provider: new ModuleUnitImporteesTreeProvider(modulesData), message: formatModulesPendingMessage() },
  };

  let currentViewMode = ViewMode.modules;

  const delegatingProvider = new DelegatingTreeDataProvider<vscode.TreeItem>(viewModes[currentViewMode].provider);

  const treeView = vscode.window.createTreeView('cppModules', {
    treeDataProvider: delegatingProvider,
    showCollapseAll: true,
  });
  treeView.description = viewModes[currentViewMode].displayName,
    treeView.message = viewModes[currentViewMode].message;

  function activateViewMode(mode: ViewMode) {
    if (currentViewMode !== mode) {
      treeView.description = viewModes[mode].displayName,
        treeView.message = viewModes[mode].message;
      delegatingProvider.setProvider(viewModes[mode].provider);
      currentViewMode = mode;
    }
  }

  // @todo: maybe messages should just be specified as a function, and this just triggers an invocation
  function updateViewModeMessage(mode: ViewMode, message: string | undefined) {
    viewModes[mode].message = message;
    if (mode === currentViewMode) {
      treeView.message = message;
    }
  }

  context.subscriptions.push(vscode.commands.registerCommand(commandId('viewMode.modulesInfo'), async () => {
    activateViewMode(ViewMode.modules);
  }));
  context.subscriptions.push(vscode.commands.registerCommand(commandId('viewMode.importers'), async () => {
    activateViewMode(ViewMode.importers);
  }));
  context.subscriptions.push(vscode.commands.registerCommand(commandId('viewMode.importees'), async () => {
    activateViewMode(ViewMode.importees);
  }));
  context.subscriptions.push(vscode.commands.registerCommand(commandId('viewMode.select'), async () => {
    interface ModePickItem extends vscode.QuickPickItem {
      mode: ViewMode;
    }
    const options: ModePickItem[] = [
      { label: 'Modules', description: 'Basic module information', picked: currentViewMode === ViewMode.modules, mode: ViewMode.modules },
      { label: 'Importers', description: 'Tree of module imports', picked: currentViewMode === ViewMode.importers, mode: ViewMode.importers },
      { label: 'Importees', description: 'Tree of module importees', picked: currentViewMode === ViewMode.importees, mode: ViewMode.importees },
    ];
    const selection = await vscode.window.showQuickPick(options, {
      placeHolder: "Select modules view mode",
    });
    if (selection) {
      activateViewMode(selection.mode);
    }
  }));

  client.onRequest('cppModulesAnalyser/enumerateWorkspaceFolderContents', async (params) => {
    const documents: { uri: string, filepath: String }[] = [];
    const tempExtensions = ['.cpp', '.cppm', '.mpp', '.ipp', '.cxx', '.cxxm', '.mxx', '.ixx', '.cc'] as const;

    const recursiveEnumerate = async (folderUri: vscode.Uri) => {
      const entries = await vscode.workspace.fs.readDirectory(folderUri);
      for (const [name, fileType] of entries) {
        const entryUri = vscode.Uri.joinPath(folderUri, name);
        if (fileType === vscode.FileType.File) {
          if (tempExtensions.includes(Utils.extname(entryUri) as any)) {
            documents.push({ uri: client.code2ProtocolConverter.asUri(entryUri), filepath: entryUri.fsPath });
          }
        } else if (fileType === vscode.FileType.Directory) {
          await recursiveEnumerate(entryUri);
        }
      }
    };

    try {
      const uri = client.protocol2CodeConverter.asUri(params.folderUri);
      await recursiveEnumerate(uri);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return new ResponseError(-32803, message); // @todo: this is RequestFailed. suspect vscode has wrappers for these?
    }

    return {
      documents,
    };
  });

  client.onNotification('cppModulesAnalyser/publishModulesInfo', (params) => {
    let message: string | undefined = undefined;
    switch (params.event) {
      case 'update':
        if (params.modules) {
          modulesData.update(params.modules, params.translationUnits);
          message = undefined;
        } else {
          //modulesData.setError();
          message = "⚠️ Below modules information is stale. Fix items in Problems window to refresh.";
        }
        break;
      case 'pending':
        //modulesData.setError();
        message = formatModulesPendingMessage();
        break;
    }
    // @note: for now at least, these use the same datasource and are always in sync
    updateViewModeMessage(ViewMode.modules, message);
    updateViewModeMessage(ViewMode.importers, message);
    updateViewModeMessage(ViewMode.importees, message);
  });
}
