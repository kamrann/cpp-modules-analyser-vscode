import * as vscode from 'vscode';
import { ModuleInfo, ModuleUnitInfo, ModulesModel, moduleUnitCount, translationUnitLocalDisplayName } from '../modules-model';
import * as treeUtils from './tree-utils'

export class ModulesTreeProvider implements vscode.TreeDataProvider<ModulesTreeItem> {
  constructor(private modulesData: ModulesModel) {
    modulesData.onDidChangeModulesData((model: ModulesModel) => {
      this._onDidChangeTreeData.fire();
    });
  }

  getTreeItem(element: ModulesTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ModulesTreeItem): Thenable<ModulesTreeItem[]> {
    // if (!this.modulesData.isValid) {
    //   return Promise.resolve([new ErrorStateItem("No modules data available, check Problems window.")]);
    // }

    if (element) {
      return Promise.resolve(
        element.children()
      );
    } else {
      // Root module nodes
      return Promise.resolve(this.modulesData.modules.map(m => new ModuleItem(m)));
    }
  }

  private _onDidChangeTreeData: vscode.EventEmitter<ModulesTreeItem | undefined | null | void> = new vscode.EventEmitter<ModulesTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ModulesTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
}

abstract class ModulesTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}`;
  }

  abstract children(): ModulesTreeItem[];
}

// class ErrorStateItem extends ModulesTreeItem {
//   constructor(
//     public readonly label: string
//   ) {
//     super(label, vscode.TreeItemCollapsibleState.None);
//     this.command = {
//       command: 'workbench.actions.view.problems',
//       title: 'View: Problems',
//     };
//   }

//   children()
//   {
//     return [];
//   }
// }

class ModuleItem extends ModulesTreeItem {
  constructor(
    private readonly moduleInfo: ModuleInfo,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.Collapsed
  ) {
    super(moduleInfo.name, collapsibleState);
    const numUnits = moduleUnitCount(moduleInfo);
    this.tooltip = `Module ${moduleInfo.name} (${numUnits > 1 ? `${numUnits} module units` : 'single unit'})`;
    this.iconPath = new vscode.ThemeIcon('package');
  }

  children() {
    return [
      new ModuleOwnedUnitItem(this.moduleInfo.primary),
      ...this.moduleInfo.interfacePartitions.map(mu => new ModuleOwnedUnitItem(mu)),
      ...this.moduleInfo.implementationPartitions.map(mu => new ModuleOwnedUnitItem(mu)),
      ...this.moduleInfo.implementationUnits.map(mu => new ModuleOwnedUnitItem(mu)),
    ];
  }
}

class ModuleOwnedUnitItem extends ModulesTreeItem {
  constructor(
    private readonly moduleUnitInfo: ModuleUnitInfo,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
  ) {
    super(translationUnitLocalDisplayName(moduleUnitInfo), collapsibleState);
    treeUtils.configureTranslationUnitTreeItem(this, moduleUnitInfo);
  }

  children() {
    return [];
  }
}
