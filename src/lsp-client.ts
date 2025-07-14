/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import { BaseLanguageClient, GenericNotificationHandler, ResponseError } from 'vscode-languageclient';
import { Utils } from 'vscode-uri';
import { ModulesTreeProvider } from './ui/modules-tree';
import { ModuleUnitImportsTreeProvider } from './ui/module-unit-imports-tree';
import { ModuleUnitImporteesTreeProvider } from './ui/module-unit-importees-tree';
import { ModulesModel } from './modules-model';
import { DelegatingTreeDataProvider } from './ui/tree-provider';
import { ProcessedSourceViewEditorProvider } from './processed-view/processed-view-custom-editor';

export const clientName = 'cppModulesAnalyser';

export function validateConfiguration(config: vscode.WorkspaceConfiguration, event: vscode.ConfigurationChangeEvent | undefined = undefined) {
  if (!event || event.affectsConfiguration(clientName + '.sourceFileExtensions')) {
    const existing = config.get<string[]>('sourceFileExtensions', []);
    const validated = existing
      .map(ext => ext.trim())
      .filter(ext => ext.length > 0)
      .map(ext => ext.startsWith('.') ? ext : ('.' + ext));
    if (validated.length != existing.length || !validated.every((ext, i) => ext === existing[i])) {
      config.update('sourceFileExtensions', validated, vscode.ConfigurationTarget.Global /* !!!!!!!!!!!!!!!!!!!!! */);
    }
  }
}

export function getDocumentFilterPatterns() {
  const defaultPatterns = {
    include: [
      "**/*.{cpp,cppm,cxx,cxxm,cc,ccm,ixx}"
    ],
    exclude: [],
  };
  const patterns = vscode.workspace.getConfiguration(clientName).get('cppSources', defaultPatterns);
  if (patterns.include === undefined) {
    patterns.include = [];
  }
  if (patterns.exclude === undefined) {
    patterns.exclude = [];
  }
  return patterns;
}

const commandId = (id: string) => {
  return `tokamak.cpp-modules-analyser-vscode.${id}`;
};

let handlePublishTranslationUnitInfo: GenericNotificationHandler;
let handlePublishModulesInfo: GenericNotificationHandler;
let devRecompileCmd: vscode.Disposable | undefined;

export function oneTimeInit(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration(clientName);
  validateConfiguration(config);

  enum ViewMode {
    modules,
    importers,
    importees,
  }

  // @todo: feels like this should probably be recreated and scoped to client init?
  const modulesData = new ModulesModel();

  interface ViewModeState {
    displayName: string,
    provider: vscode.TreeDataProvider<vscode.TreeItem>;
    message: string | undefined;
  }

  const formatModulesPendingMessage = () => {
    return `${modulesData.isEmpty == false ? "⚠️ Below modules information is out of date. " : ""}Recalculating...`;
  };

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

  context.subscriptions.push(ProcessedSourceViewEditorProvider.register(context));

  handlePublishTranslationUnitInfo = (params, client: BaseLanguageClient) => {
    const temp = params.pp_tokens.join(' ');
    client.outputChannel.appendLine(temp);
  }

  handlePublishModulesInfo = (params) => {
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
  };
}

export function initializeClient(context: vscode.ExtensionContext, client: BaseLanguageClient) {
  client.onRequest('cppModulesAnalyser/enumerateWorkspaceFolderContents', async (params) => {
    // const documents: { uri: string, filepath: string }[] = [];
    // const extensions = vscode.workspace.getConfiguration(clientName).get('sourceFileExtensions', []);

    // const recursiveEnumerate = async (folderUri: vscode.Uri) => {
    //   const entries = await vscode.workspace.fs.readDirectory(folderUri);
    //   for (const [name, fileType] of entries) {
    //     const entryUri = vscode.Uri.joinPath(folderUri, name);
    //     if (fileType === vscode.FileType.File) {
    //       // @note: feels like most robust way to test, allowing for possibility of double extensions, etc.
    //       if (extensions.find(ext => entryUri.path.endsWith(ext)) !== undefined) {
    //         documents.push({ uri: client.code2ProtocolConverter.asUri(entryUri), filepath: entryUri.fsPath });
    //       }
    //     } else if (fileType === vscode.FileType.Directory) {
    //       await recursiveEnumerate(entryUri);
    //     }
    //   }
    // };

    // try {
    //   const uri = client.protocol2CodeConverter.asUri(params.folderUri);
    //   await recursiveEnumerate(uri);
    // } catch (err) {
    //   const message = err instanceof Error ? err.message : String(err);
    //   return new ResponseError(-32803, message); // @todo: this is RequestFailed. suspect vscode has wrappers for these?
    // }

    const patterns: { include: string[], exclude: string[] } = getDocumentFilterPatterns();

    const unionUris = (uris: vscode.Uri[][]) => {
      const op = (union: Set<vscode.Uri>, uris: vscode.Uri[]) => {
        for (const uri of uris) {
          union.add(uri);
        }
        return union;
      };
      return uris.reduce(op, new Set<vscode.Uri>());
    };

    const includeSet = async () => {
      const raw = await Promise.all(patterns.include.map(p => vscode.workspace.findFiles(p)));
      return unionUris(raw);
    };
    const excludeSet = async () => {
      const raw = await Promise.all(patterns.exclude.map(p => vscode.workspace.findFiles(p)));
      return unionUris(raw);
    };

    const [toInclude, toExclude] = await Promise.all([includeSet(), excludeSet()]);
    // because JS
    const toExcludeStrings = new Set([...toExclude].map(uri => uri.toString()));
    const results = [...toInclude].filter(x => !toExcludeStrings.has(x.toString()));

    return {
      documents: results.map(uri => ({ uri: client.code2ProtocolConverter.asUri(uri), filepath: uri.fsPath })),
    };
  });

  interface PreprocessedTU {
    ppTokens: string[];
    tokens: string[];
  }
  const preprocessedTUs: Record<string, PreprocessedTU> = {};

  const TUQueryKeys = {
    view: 'view',
  } as const;

  const TUViewModeParams = {
    ppTokens: 'pp-tokens',
    preprocessed: 'preprocessed',
  } as const;

  const virtualUriScheme = 'cpp-ma';

  const adaptUriForProcessed = (uri: vscode.Uri) => {
    return uri.with({
      scheme: virtualUriScheme,
      path: uri.path + '.' + 'processed',
    });
  };

  const preprocessedSourceProvider = new (class implements vscode.TextDocumentContentProvider {
    onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
    onDidChange = this.onDidChangeEmitter.event;
    activeUris = new Set<vscode.Uri>(); // @todo: how to remove?

    provideTextDocumentContent(uri: vscode.Uri): string | undefined {
      const baseUri = uri.with({ query: '', fragment: '' });
      const tu = preprocessedTUs[baseUri.toString()];
      if (!tu) {
        // may make more sense to show a notification or log something
        return undefined; //'<unavailable>';
      }
      const queryParams = new URLSearchParams(uri.query);
      switch (queryParams.get(TUQueryKeys.view)) {
        case TUViewModeParams.ppTokens:
          this.activeUris.add(uri);
          return tu.ppTokens.join(' ');
        case TUViewModeParams.preprocessed:
          this.activeUris.add(uri);
          return tu.tokens.join(' ');
        default:
          return undefined;
      }
    }

    onBaseUriChanged(baseUri: vscode.Uri) {
      const matches = (uri: vscode.Uri) => {
        return uri.with({ query: '', fragment: '' }).toString() === baseUri.toString();
      };
      for (const uri of this.activeUris) {
        if (matches(uri)) {
          this.onDidChangeEmitter.fire(uri);
        }
      }
    }
  })();

  vscode.workspace.onDidCloseTextDocument(doc => {
    if (doc.uri.scheme === virtualUriScheme) {
      preprocessedSourceProvider.activeUris.delete(doc.uri);
    }
  });

  client.onNotification('cppModulesAnalyser/publishTranslationUnitInfo', (params) => {
    //handlePublishTranslationUnitInfo(params, client, preprocessedTUs);
    const fileUri = client.protocol2CodeConverter.asUri(params.uri);
    const virtualUri = adaptUriForProcessed(fileUri);
    switch (params.event) {
      case 'update':
        preprocessedTUs[virtualUri.toString()] = {
          ppTokens: params.ppTokens,
          tokens: params.tokens,
        };
        break;
      // need to update, think server currently sends this in case of preprocessor fail
      case 'pending':
        delete preprocessedTUs[virtualUri.toString()];
        break;
    }
    //preprocessedSourceProvider.onDidChangeEmitter.fire(virtualUri);
    preprocessedSourceProvider.onBaseUriChanged(virtualUri);
  });
  client.onNotification('cppModulesAnalyser/publishModulesInfo', handlePublishModulesInfo);

  // @todo: make conditional based on dev build
  devRecompileCmd = vscode.commands.registerCommand(commandId('dev.recompileToolchain'), () => {
    client.sendNotification('cppModulesAnalyser/dev/recompileToolchain');
  });

  context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(virtualUriScheme, preprocessedSourceProvider));

  const openVirtualSourceView = async (view: string) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const currentDoc = editor.document;

    const query = new URLSearchParams({ [TUQueryKeys.view]: view })
    const virtualUri = adaptUriForProcessed(currentDoc.uri).with({
      query: query.toString(),
    });
    const ppDoc = await vscode.workspace.openTextDocument(virtualUri);

    // @note: incomplete and seems a bit unpredictable. anyway probably not worth it since using a custom text editor means we lose
    // ability to treat our views as source code and get associated behaviour, like for example sending the processed code back to the lsp
    // for syntax highlighting and such.
    //await vscode.commands.executeCommand('vscode.openWith', virtualUri, 'tokamak.cpp-modules-analyser-vscode.processedSourceView');

    // @todo: so reverting to default text editor, but this means we lose ability to customize anything, such as tab label.
    // might be better to encode the view (pp-tokens, preprocessed, etc) into the path (path/to/filename.pp-tokens) to allow easy differentiation and 
    // opening of multiple views.

    await vscode.window.showTextDocument(ppDoc, {
      viewColumn: vscode.ViewColumn.Beside,
      preserveFocus: true,
      preview: true,
    });
  };

  const openPPTokensSourceCommand = vscode.commands.registerCommand(commandId('openPPTokens'), async () => {
    await openVirtualSourceView(TUViewModeParams.ppTokens);
  });
  const openPreprocessedSourceCommand = vscode.commands.registerCommand(commandId('openPreprocessed'), async () => {
    await openVirtualSourceView(TUViewModeParams.preprocessed);
  });

  context.subscriptions.push(openPPTokensSourceCommand);
  context.subscriptions.push(openPreprocessedSourceCommand);
}

export function shutdownClient(context: vscode.ExtensionContext, client: BaseLanguageClient) {
  devRecompileCmd?.dispose();
  devRecompileCmd = undefined;
}
