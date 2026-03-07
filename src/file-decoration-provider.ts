import * as vscode from 'vscode';

export class AnalyzerDecorationProvider implements vscode.FileDecorationProvider {

  private _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[]>();
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  private pendingFiles = new Set<string>();
  private analysingFiles = new Set<string>();

  provideFileDecoration(uri: vscode.Uri): vscode.ProviderResult<vscode.FileDecoration> {

    if (this.pendingFiles.has(uri.toString())) {
      return {
        badge: "…",
        tooltip: "Pending analysis",
        //color: new vscode.ThemeColor("list.warningForeground")
      };
    }

    if (this.analysingFiles.has(uri.toString())) {
      return {
        badge: "!",
        tooltip: "Analysis in progress",
        color: new vscode.ThemeColor("list.warningForeground")
      };
    }

    return;
  }

  setPending(uri: vscode.Uri) {
    this.analysingFiles.delete(uri.toString());
    this.pendingFiles.add(uri.toString());
    this._onDidChangeFileDecorations.fire(uri);
  }

  setAnalysing(uri: vscode.Uri) {
    this.pendingFiles.delete(uri.toString());
    this.analysingFiles.add(uri.toString());
    this._onDidChangeFileDecorations.fire(uri);
  }

  clear(uri: vscode.Uri) {
    this.pendingFiles.delete(uri.toString());
    this.analysingFiles.delete(uri.toString());
    this._onDidChangeFileDecorations.fire(uri);
  }
}
