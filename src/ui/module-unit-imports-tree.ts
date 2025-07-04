import * as vscode from 'vscode';
import { ModuleInfo, TranslationUnitInfo, ModuleUnitInfo, translationUnitDisplayName, ModulesModel, ModuleImport } from '../modules-model';
import * as treeUtils from './tree-utils'

export class ModuleUnitImportsTreeProvider implements vscode.TreeDataProvider<ModuleUnitImportsTreeItem> {
  constructor(private modulesData: ModulesModel) {
    modulesData.onDidChangeModulesData((model: ModulesModel) => {
      this._onDidChangeTreeData.fire();
    });
  }

  getTreeItem(element: ModuleUnitImportsTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ModuleUnitImportsTreeItem): Thenable<ModuleUnitImportsTreeItem[]> {
    if (element) {
      return Promise.resolve(
        element.children()
      );
    } else {
      // Root nodes (translation units which are not imported by anything)
      return Promise.resolve(this.modulesData.translationUnits
        .filter(tu => !tu.isModuleUnit || (tu as ModuleUnitInfo).importers.length === 0)
        .map(tu => new TranslationUnitItem(tu)));
    }
  }

  private _onDidChangeTreeData: vscode.EventEmitter<ModuleUnitImportsTreeItem | undefined | null | void> = new vscode.EventEmitter<ModuleUnitImportsTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ModuleUnitImportsTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
}

abstract class ModuleUnitImportsTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}`;
  }

  abstract children(): ModuleUnitImportsTreeItem[];
}

class TranslationUnitItem extends ModuleUnitImportsTreeItem {
  constructor(
    private readonly translationUnitInfo: TranslationUnitInfo
  ) {
    super(translationUnitDisplayName(translationUnitInfo), translationUnitInfo.imports.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
    treeUtils.configureTranslationUnitTreeItem(this, translationUnitInfo);
  }

  children() {
    return this.translationUnitInfo.imports.map((imp: ModuleImport) => new ImportableModuleUnitItem(imp.isPartition ? (imp.ref as ModuleUnitInfo) : (imp.ref as ModuleInfo).primary));
  }
}

class ImportableModuleUnitItem extends TranslationUnitItem {
  constructor(
    moduleUnitInfo: ModuleUnitInfo
  ) {
    super(moduleUnitInfo);
  }
}
