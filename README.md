# C++ Modules Analyser - VS Code

A Visual Studio Code extension providing program-wide checks relating to C++20 modules, along with UI tree views of module contents and dependencies.

Due to C++'s independent compilation model, a number of semantic requirements on modules are IFNDR, meaning the compiler alone is not required to (and in some cases cannot possibly) diagnose a failure to comply with these requirements. One goal of this extension is to diagnose all high level modules-related semantic errors - those that compilers will diagnose, those that may be handled by build tools, and others that may not be picked up by either.

Alongside that, the intention is to provide features to give a picture of the modular structure of a project, in particular, the module unit dependency graph.

## Functionality

- Basic translation unit parsing. The parser is minimal - the focus is on higher level checks so the assumption is that the code is well-formed at the C++ grammar level. When it's not, parsing errors will be emitted but they will be extremely unhelpful!
- Diagnostics for semantic errors relating to modules usage:
  - Unknown import
  - Invalid import of partition in GMF/non-module unit
  - Invalid explicit import of containing module in module implementation unit
  - Duplicated module/partition name
  - Missing/multiple primary interface unit
  - Module interface dependency cycle
- Modules view in the Explorer tab, showing an expandable tree with the following modes:
  - *Modules*: lists all modules at the root level, expandable to show contained module units
  - *Imports*: translation units expanding to show imported module units (similar to typical include tree)
  - *Importees*: module units expanding to show translation units which import them (similar to typical includees tree)

The analysis is implemented through the LSP protocol. It is designed update in response to workspace/file changes as well as live source code edits.

## Usage

The extension should auto-activate for any workspace containing sources with typical C++ file extensions. You should then see an additional view named 'MODULES' (initially collapsed) in the EXPLORER tab. Use the dropdown icon in the top right to toggle the view mode.

Any detected issues will be presented in the usual PROBLEMS tab.

There is also a *C++ Modules Analyser* channel added in the OUTPUT tab with some logging.

## Limitations

The aim at this stage is for the extension to be usable with simple, greenfield modules projects. However, it currently has some major limitations that make it unlikely to work with most real world codebases.

### Program/Project structure

Currently the extension treats all files with accepted extension in the entire workspace (including all roots in a multi-root workspace) as a single C++ program for the purposes of the analysis. This is of course not practical for use with real world projects, so support for *compile-commands.json* is planned.

### C++ Preprocessor
The preprocessor implementation is very minimal. In particular:
- `#ifdef`, `#ifndef` conditionals are supported with predefined program wide macro definitions.
- No support for macros defined in the source code via `#define`.
- No support for constant expressions within `#if` (including `#if defined`).
- No support for function-like macros.
- `#includes` are not processed, so any `import`s in headers will be missed.
The intention is that the above unsupported elements should all parse, but the blocks will not be evaluated.

Improved preprocessor support will be an ongoing task.

### Missing diagnostics
- Handling of `export` is not yet implemented, so diagnosing a failure to export all interface partitions from the primary module unit is currently missing.

### Other pending issues
- Reported problems will link to a source file where applicable, but currently have no line-level anchors.

## Requirements

Currently limited to VS Code Desktop running on Windows.
