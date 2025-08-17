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

The extension should auto-activate for any workspace containing sources with typical C++ file extensions. You should see an additional view named 'MODULES' (initially collapsed) in the EXPLORER tab. Use the dropdown icon in the top right to toggle the view mode.

Any detected issues will be presented in the usual PROBLEMS tab.

There is also a *C++ Modules Analyser* channel added in the OUTPUT tab with some logging.

The extension exposes the following configuration settings, under *Extensions | C++ Modules Analyser*:
- *Cpp Sources*: Lists of include/exclude file globs, determining which files in the workspace are processed as C++ translation units.
- *Global Defines*: List of preprocessor defines.
- *External Modules*: Module names can be given here for any modules that the project imports but which are not defined within the workspace. Note: all such external modules must be specified, but currently are not included in the resulting output.

## Limitations

The aim at this stage is for the extension to be usable with simple, greenfield modules projects. However, it currently has some major limitations that make it unlikely to work with most real world codebases.

### Program/Project structure

Currently the extension allows for glob-based specification of the files in the workspace which should be considered as translation units, but then operates under the assumption that all those files together form a single C++ program for the purposes of the analysis. This is of course not practical for use with real world projects which can have multiple build targets under a workspace folder, so support for *compile-commands.json* is planned.

### C++ Preprocessor
The preprocessor implementation is limited, but growing. In particular:
- Conditional inclusion with `#if` and variants should now be largely supported, using both predefined program wide object-like macro definitions and `#define`s in the code. However, preprocessor constant expression syntax is still not 100% conformant.
- Preprocessor operators `#` and `##` are implemented but have had minimal testing.
- `__VA_OPT__` is not implemented.
- `#includes` are not processed, so any `import`s in headers will be missed.
- `__cplusplus`, `__FILE__`, `__DATE__` and `__TIME__` are pending proper implementation and will just expand to placeholders.
- No support yet for defining function-like macros through the global defines.
- Some whitespace usages within preprocessor directives is not correctly handled. Generally this will manifest as being too permissive.

### Other pending issues
- Reported problems will link to a source file where applicable, but currently have no line-level anchors.

## Requirements

Currently limited to VS Code Desktop, Windows and Linux (untested).
