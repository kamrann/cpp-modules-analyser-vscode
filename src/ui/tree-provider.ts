import * as vscode from 'vscode';

export class DelegatingTreeDataProvider<T> implements vscode.TreeDataProvider<T> {
  private _activeProvider: vscode.TreeDataProvider<T>;

  private _onDidChangeTreeData = new vscode.EventEmitter<T | undefined>();
  readonly onDidChangeTreeData: vscode.Event<T | undefined> = this._onDidChangeTreeData.event;

  constructor(initialProvider: vscode.TreeDataProvider<T>) {
    this._activeProvider = initialProvider;
    this.forwardOnChanged();
  }

  forwardOnChanged() {
    // Forward refresh requests
    if (this._activeProvider.onDidChangeTreeData) {
      this._activeProvider.onDidChangeTreeData(() => this.refresh());
    }
  }

  setProvider(provider: vscode.TreeDataProvider<T>) {
    this._activeProvider = provider;
    this.forwardOnChanged();
    this.refresh();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: T): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return this._activeProvider.getTreeItem(element);
  }

  getChildren(element?: T): vscode.ProviderResult<T[]> {
    return this._activeProvider.getChildren(element);
  }

  getParent?(element: T): vscode.ProviderResult<T> {
    return this._activeProvider.getParent?.(element);
  }
}
