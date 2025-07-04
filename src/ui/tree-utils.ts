import * as vscode from 'vscode';
import { ModuleUnitInfo, TranslationUnitInfo, moduleKindNames } from '../modules-model';

export function configureTranslationUnitTreeItem(item: vscode.TreeItem, tu: TranslationUnitInfo) {
  if (tu.isModuleUnit) {
    const mu = tu as ModuleUnitInfo;
    item.description = `${moduleKindNames[mu.kind]}`;
    item.tooltip = `${moduleKindNames[mu.kind]} at ${tu.uri.path}`;
  } else {
    item.tooltip = `Non-module unit at ${tu.uri.path}`;
  }
  item.command = {
    command: 'vscode.open',
    title: 'Open Translation Unit Source',
    arguments: [tu.uri],
  };
}
