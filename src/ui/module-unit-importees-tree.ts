import * as vscode from 'vscode';
import { ModuleInfo, TranslationUnitInfo, ModuleUnitInfo, translationUnitDisplayName, ModulesModel, ModuleImport } from '../modules-model';
import * as treeUtils from './tree-utils'

export class ModuleUnitImporteesTreeProvider implements vscode.TreeDataProvider<ModuleUnitImporteesTreeItem> {
  constructor(private modulesData: ModulesModel) {
    modulesData.onDidChangeModulesData((model: ModulesModel) => {
      this._onDidChangeTreeData.fire();
    });
  }

  getTreeItem(element: ModuleUnitImporteesTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ModuleUnitImporteesTreeItem): Thenable<ModuleUnitImporteesTreeItem[]> {
    if (element) {
      return Promise.resolve(
        element.children()
      );
    } else {
      // Root nodes (module units which have no imports)
      return Promise.resolve(this.modulesData.translationUnits
        .filter(tu => tu.imports.length === 0)
        .map(tu => new TranslationUnitItem(tu)));
    }
  }

  private _onDidChangeTreeData: vscode.EventEmitter<ModuleUnitImporteesTreeItem | undefined | null | void> = new vscode.EventEmitter<ModuleUnitImporteesTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ModuleUnitImporteesTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
}

abstract class ModuleUnitImporteesTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}`;
  }

  abstract children(): ModuleUnitImporteesTreeItem[];
}

class TranslationUnitItem extends ModuleUnitImporteesTreeItem {
  constructor(
    private readonly translationUnitInfo: TranslationUnitInfo
  ) {
    super(translationUnitDisplayName(translationUnitInfo), translationUnitInfo.isModuleUnit && (translationUnitInfo as ModuleUnitInfo).importers.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
    treeUtils.configureTranslationUnitTreeItem(this, translationUnitInfo);
  }

  children() {
    if (this.translationUnitInfo.isModuleUnit) {
      const mu = this.translationUnitInfo as ModuleUnitInfo;
      return mu.importers.map((tu: TranslationUnitInfo) => new ImportingModuleUnitItem(tu));
    } else {
      return [];
    }
  }
}

class ImportingModuleUnitItem extends TranslationUnitItem {
  constructor(
    translationUnitInfo: TranslationUnitInfo
  ) {
    super(translationUnitInfo);
  }
}
