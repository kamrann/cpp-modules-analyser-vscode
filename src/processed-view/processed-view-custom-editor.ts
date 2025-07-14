import * as vscode from 'vscode';

export class ProcessedSourceViewEditorProvider implements vscode.CustomTextEditorProvider {

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new ProcessedSourceViewEditorProvider(context);
    const providerRegistration = vscode.window.registerCustomEditorProvider(
      ProcessedSourceViewEditorProvider.viewType,
      provider);
    return providerRegistration;
  }

  private static readonly viewType = 'tokamak.cpp-modules-analyser-vscode.processedSourceView';

  constructor(
    private readonly context: vscode.ExtensionContext
  ) { }

  /**
   * Called when custom editor is opened.
   */
  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
    };
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    function updateWebview() {
      webviewPanel.webview.postMessage({
        type: 'update',
        text: document.getText(),
      });
    }

    // Hook up event handlers so that we can synchronize the webview with the text document.
    //
    // The text document acts as our model, so we have to sync change in the document to our
    // editor and sync changes in the editor back to the document.
    // 
    // Remember that a single text document can also be shared between multiple custom
    // editors (this happens for example when you split a custom editor)

    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.uri.toString() === document.uri.toString()) {
        updateWebview();
      }
    });

    // Make sure we get rid of the listener when our editor is closed.
    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
    });

    // // Receive message from the webview.
    // webviewPanel.webview.onDidReceiveMessage(e => {
    //   switch (e.type) {
    //     case 'add':
    //       this.addNewScratch(document);
    //       return;

    //     case 'delete':
    //       this.deleteScratch(document, e.id);
    //       return;
    //   }
    // });

    updateWebview();
  }

  /**
   * Get the static html used for the editor webviews.
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    return /* html */`
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<title>Is this showing?</title>
			</head>
			<body>
        <pre id="content"></pre>

        <script>
          const vscode = acquireVsCodeApi();

          window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'update') {
              document.getElementById('content').textContent = message.text;
            }
          });
        </script>				
			</body>
			</html>`;
  }

  /**
   * Add a new scratch to the current document.
   */
  // private addNewScratch(document: vscode.TextDocument) {
  //   const json = this.getDocumentAsJson(document);
  //   // const character = CatScratchEditorProvider.scratchCharacters[Math.floor(Math.random() * CatScratchEditorProvider.scratchCharacters.length)];
  //   // json.scratches = [
  //   //   ...(Array.isArray(json.scratches) ? json.scratches : []),
  //   //   {
  //   //     id: getNonce(),
  //   //     text: character,
  //   //     created: Date.now(),
  //   //   }
  //   // ];

  //   return this.updateTextDocument(document, json);
  // }

  /**
   * Write out the json to a given document.
   */
  // private updateTextDocument(document: vscode.TextDocument, json: any) {
  //   const edit = new vscode.WorkspaceEdit();

  //   // Just replace the entire document every time for this example extension.
  //   // A more complete extension should compute minimal edits instead.
  //   edit.replace(
  //     document.uri,
  //     new vscode.Range(0, 0, document.lineCount, 0),
  //     JSON.stringify(json, null, 2));

  //   return vscode.workspace.applyEdit(edit);
  // }
}
