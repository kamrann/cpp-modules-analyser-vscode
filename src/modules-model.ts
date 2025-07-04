import * as vscode from 'vscode';
import { Utils } from 'vscode-uri';
import { createUriConverters } from '@vscode/wasm-wasi-lsp';

type RawModuleInfo = any;
type RawTranslationUnitInfo = any;

export interface ModuleInfo {
  readonly name: string;
  readonly primary: ModuleUnitInfo;
  readonly interfacePartitions: ModuleUnitInfo[];
  readonly implementationPartitions: ModuleUnitInfo[];
  readonly implementationUnits: ModuleUnitInfo[];
}

export enum ModuleUnitKind {
  primaryInterface,
  interfacePartition,
  implementationPartition,
  implementation,
}

export const moduleKindNames: Record<ModuleUnitKind, string> = {
  [ModuleUnitKind.primaryInterface]: "Primary interface unit",
  [ModuleUnitKind.interfacePartition]: "Interface partition unit",
  [ModuleUnitKind.implementationPartition]: "Non-interface partition unit",
  [ModuleUnitKind.implementation]: "Implementation unit",
};

// @todo: maybe should drop name given we have ref?
export interface ModuleImport {
  readonly name: string;
  readonly isPartition: boolean;
  // @todo: ideally should be readonly, would need to use an intermediate representation though as we can't form refs until we've created all MUs.
  // alternatively, requiring that that server send TUs in dependency sorted order would probably be cleaner.
  //readonly ref: ModuleInfo | ModuleUnitInfo;
  ref: ModuleInfo | ModuleUnitInfo;
}

export interface TranslationUnitInfo {
  readonly uri: vscode.Uri;
  /*readonly*/ imports: ModuleImport[]; // @todo: non-readonly pending better solution then external module exclusion
  readonly isModuleUnit: boolean;
}

export interface ModuleUnitInfo extends TranslationUnitInfo {
  readonly moduleName: string;
  readonly kind: ModuleUnitKind;
  readonly partitionName: string | undefined;
  readonly importers: TranslationUnitInfo[];
}

export function moduleUnitCount(m: ModuleInfo): number {
  return 1 + m.interfacePartitions.length + m.implementationPartitions.length + m.implementationUnits.length;
}

// @NOTE: Not unique, all implementation units will yield the same name.
export function moduleUnitQualifiedName(mu: ModuleUnitInfo): string {
  return mu.partitionName ? (mu.moduleName + ":" + mu.partitionName) : mu.moduleName;
}

export function translationUnitName(tu: TranslationUnitInfo): string {
  if (tu.isModuleUnit) {
    const mu = tu as ModuleUnitInfo;
    switch (mu.kind) {
      case ModuleUnitKind.primaryInterface:
        return mu.moduleName;
      case ModuleUnitKind.interfacePartition:
      case ModuleUnitKind.implementationPartition:
        return mu.moduleName + ":" + mu.partitionName;
      case ModuleUnitKind.implementation:
        // Implementation units have no unique name, so use source file uri
        return Utils.basename(mu.uri);
    }
  } else {
    return Utils.basename(tu.uri);
  }
}

export function translationUnitLocalName(tu: TranslationUnitInfo): string {
  if (tu.isModuleUnit) {
    const mu = tu as ModuleUnitInfo;
    switch (mu.kind) {
      case ModuleUnitKind.interfacePartition:
      case ModuleUnitKind.implementationPartition:
        return ":" + mu.partitionName;
    }
  }

  return translationUnitName(tu);
}

export function translationUnitDisplayName(tu: TranslationUnitInfo): string {
  // @note: intentionally adding space as otherwise the colon is hard to see in default theme font
  return translationUnitName(tu).replace(':', " :");
}

export function translationUnitLocalDisplayName(tu: TranslationUnitInfo): string {
  return translationUnitLocalName(tu);
}

function createModuleInfo(name: string, primary: ModuleUnitInfo): ModuleInfo {
  return {
    name: name,
    primary: primary,
    interfacePartitions: [],
    implementationPartitions: [],
    implementationUnits: [],
  };
}

const brokenDataError = new Error("Invalid modules data");

export class ModulesModel {
  isValid = false;
  translationUnits: TranslationUnitInfo[] = [];
  moduleUnits: ModuleUnitInfo[] = [];
  modules: ModuleInfo[] = [];

  constructor() { }

  private _onDidChangeModulesData: vscode.EventEmitter<ModulesModel> = new vscode.EventEmitter<ModulesModel>();
  readonly onDidChangeModulesData: vscode.Event<ModulesModel> = this._onDidChangeModulesData.event;

  onError(error: string): never {
    this.isValid = false;
    this._onDidChangeModulesData.fire(this);
    throw new Error(error);
  }

  public get isEmpty(): boolean {
    return this.translationUnits.length == 0;
  }

  public update(rawModules: RawModuleInfo[], rawTranslationUnits: RawTranslationUnitInfo[]): void {
    const uriConverters = createUriConverters();
    if (!uriConverters) {
      this.onError("URI converters unavailable");
    }

    const isModuleUnit = (tu: RawTranslationUnitInfo) => tu.result.module_unit.variant === 0;
    const convertTranslationUnit = (tu: RawTranslationUnitInfo, isModuleUnit: boolean) => {
      // @note: seems iffy to use this function imported from vscode/wasm-wasi-lsp, since this is just a VS Code <-> LSP conversion.
      // but seems to work (despite added a / before the drive letter), whereas Uri.parse gives us /workspace/... which is apparently not what VS Code wants...
      const uri = uriConverters.protocol2Code(tu.identifier); //vscode.Uri.parse(tu.identifier),
      return {
        uri: uri,
        imports: tu.result.imports.map((imp: any) => ({
          name: imp.data.name.join("."),
          isPartition: imp.data.is_partition,
          ref: null,
        })),
        isModuleUnit: isModuleUnit,
      };
    };
    const convertModuleUnit = (tuInfo: TranslationUnitInfo, rawModuleUnit: any) => {
      const isPartition: boolean = rawModuleUnit.partition_name.variant === 0;
      const extractKind = () => {
        return rawModuleUnit.is_interface ?
          (isPartition ? ModuleUnitKind.interfacePartition : ModuleUnitKind.primaryInterface) :
          (isPartition ? ModuleUnitKind.implementationPartition : ModuleUnitKind.implementation);
      };
      return {
        ...tuInfo,
        moduleName: rawModuleUnit.module_name.join("."),
        kind: extractKind(),
        partitionName: isPartition ? rawModuleUnit.partition_name.value.join(".") : null,
        importers: [],
      };
    };
    const translationUnitConverter = (tu: RawTranslationUnitInfo) => {
      if (isModuleUnit(tu)) {
        return convertModuleUnit(convertTranslationUnit(tu, true), tu.result.module_unit.value);
      } else {
        return convertTranslationUnit(tu, false);
      }
    };

    this.translationUnits = rawTranslationUnits
      .map(translationUnitConverter);
    this.moduleUnits = this.translationUnits
      .filter(tu => tu.isModuleUnit)
      .map(tu => tu as ModuleUnitInfo);

    const findPrimaryUnit = (name: string): ModuleUnitInfo => {
      const entry = this.moduleUnits.find(mu => mu.kind === ModuleUnitKind.primaryInterface && mu.moduleName === name);
      if (entry === undefined) {
        throw brokenDataError;
      }
      return entry;
    };

    this.modules = rawModules.map(m => createModuleInfo(m.name.join("."), findPrimaryUnit(m.name.join("."))));

    const tryFindModule = (name: string): ModuleInfo | undefined => {
      return this.modules.find(m => m.name === name);
    };

    // @todo: temp pending better solution.
    // for now, we just remove any imports of external modules
    for (const tu of this.translationUnits) {
      tu.imports = tu.imports.filter(imp => imp.isPartition || tryFindModule(imp.name));
    }

    const findModule = (name: string): ModuleInfo => {
      const entry = tryFindModule(name);
      if (entry === undefined) {
        throw brokenDataError;
      }
      return entry;
    };

    const findModulePartition = (moduleName: string, partitionName: string): ModuleUnitInfo => {
      const entry = this.moduleUnits.find(mu => mu.moduleName === moduleName && mu.partitionName === partitionName);
      if (entry === undefined) {
        throw brokenDataError;
      }
      return entry;
    };

    const resolvePartitionImport = (importee: string, containingModule: string) => {
      return findModulePartition(containingModule, importee);
    };
    const resolveModuleImport = (importee: string) => {
      return findModule(importee);
    };

    for (const tu of this.translationUnits) {
      // Resolve import references.
      for (const imp of tu.imports) {
        if (imp.isPartition) {
          imp.ref = resolvePartitionImport(imp.name, (tu as ModuleUnitInfo).moduleName);
          imp.ref.importers.push(tu);
        } else {
          imp.ref = resolveModuleImport(imp.name);
          imp.ref.primary.importers.push(tu);
        }
      }

      if (tu.isModuleUnit) {
        const mu = tu as ModuleUnitInfo;
        // Populate references in owning module.
        switch (mu.kind) {
          case ModuleUnitKind.primaryInterface:
            break;
          case ModuleUnitKind.interfacePartition:
            findModule(mu.moduleName).interfacePartitions.push(mu);
            break;
          case ModuleUnitKind.implementationPartition:
            findModule(mu.moduleName).implementationPartitions.push(mu);
            break;
          case ModuleUnitKind.implementation:
            findModule(mu.moduleName).implementationUnits.push(mu);
            break;
        }
      }
    }

    this.isValid = true;
    this._onDidChangeModulesData.fire(this);
  }

  public setError() {
    this.isValid = false;
    this._onDidChangeModulesData.fire(this);
  }
}
