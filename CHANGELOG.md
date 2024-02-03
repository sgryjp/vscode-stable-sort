# Change Log

<a name="unreleased"></a>

## [Unreleased]

<a name="v1.3.0"></a>

## [v1.3.0] - 2024-02-03

### Added

- Try to sort tokens separated by dots (periods) if no whitespaces are selected.
  - This is useful for sorting CSS [compound selectors][compound-selector].
  - This feature can be disabled by setting `useDotAsWordSeparator` to `false`.

<a name="v1.2.2"></a>

## [v1.2.2] - 2022-12-10

### Fixed

- Fix badge image URL in REAMDE

<a name="v1.2.1"></a>

## [v1.2.1] - 2022-11-26

### Fixed

- Set up GitHub Action to publish extension on pushing tags
  to both Visual Studio Marketplace and Open VSX Repository.
- Update dependencies

<a name="v1.2.0"></a>

## [v1.2.0] - 2022-05-16

### Changed

- Update [meaw](https://github.com/susisu/meaw) to v6.0.0
- Recreated as a Web extension (GitHub Codespaces supported)
- **BREAKING CHANGE**: Renamed the extension to "_Smart Sort_" (from Stable Sort)

  - Name of commands and configurations are changed accordingly:

    - (Command) `stableSort.sortAscending` → `smartSort.sortAscending`
    - (Command) `stableSort.sortDescending` → `smartSort.sortDescending`
    - (Configuration) `stableSort.preferWordSorting` → `smartSort.preferWordSorting`

<a name="v1.1.0"></a>

## [v1.1.0] - 2019-06-23

### Added

- New setting `stableSort.preferWordSorting` (see Changed subsection below)

### Changed

- Now lines touched by a selection will be sorted under the condition below
  unless `stableSort.preferWordSorting` setting is set `true`
  1. there is only one selection range
  2. it covers multiple lines
  3. either it's start or end position is not at the beginning of a line

### Fixed

- Words may be concatenated on sorting (Issue #2)

<a name="v1.0.0"></a>

## [v1.0.0] - 2019-06-16

### Added

- Unified commands to sort words and lines
  - New keybinding: <kbd>Ctrl+Alt+R</kbd> and <kbd>Ctrl+Alt+Shift+R</kbd>
    (mac: <kbd>Cmd+Ctrl+R</kbd> and <kbd>Cmd+Ctrl+Shift+R</kbd>)
- Now words spread over multiple lines can be sorted
- Now whether to sort numerically or not are guessed automatically

### Changed

- Changed zlib License to MIT License
- Removed character code based sorting (not considered useful much)
- Now this extension reproduces spaces around separators according to what
  the separator character is
  - If it's a comma (`,`) or a tab (`\t`), only trailing whiespaces will be
    reproduced
  - If it's a vertical bar (or "pipe", `|`), preceding whiespaces and/or
    trailling whitespaces will be reproduced
  - Reproduced whitespace will always be a single space (U+0020)
- Now word separator is guessed using firstly appeared candidate

### Fixed

- Now ignores spaces after tab characters on sorting words separated with them
- Wrongly treated consecutive occurrence of separators as single occurrence

<a name="v0.3.0"></a>

## [v0.3.0] - 2018-10-01

### Added

- New sort options to use character code for string comparison

### Changed

- Renamed to "Stable Sort"

<a name="v0.2.1-beta"></a>

## [v0.2.1-beta] - 2018-09-18

### Changed

- Now uses user environment language as the locale for comparing strings

### Fixed

- Sort result is not stable if sorting in descending order

<a name="v0.2.0"></a>

## [v0.2.0-beta] - 2018-09-17

### Added

- New commands to sort words in a selection range
- Add many new features

### Changed

- Renamed to "xsort"

<a name="v0.1.0-beta"></a>

## [v0.1.0-beta] - 2018-09-16

### Add

- Initial beta release

[Unreleased]: https://github.com/sgryjp/vscode-stable-sort/compare/v1.3.0...HEAD
[v1.3.0]: https://github.com/sgryjp/vscode-stable-sort/compare/v1.2.2...v1.3.0
[v1.2.2]: https://github.com/sgryjp/vscode-stable-sort/compare/v1.2.1...v1.2.2
[v1.2.1]: https://github.com/sgryjp/vscode-stable-sort/compare/v1.2.0...v1.2.1
[v1.2.0]: https://github.com/sgryjp/vscode-stable-sort/compare/v1.1.0...v1.2.0
[v1.1.0]: https://github.com/sgryjp/vscode-stable-sort/compare/v1.0.0...v1.1.0
[v1.0.0]: https://github.com/sgryjp/vscode-stable-sort/compare/v0.3.0...v1.0.0
[v0.3.0]: https://github.com/sgryjp/vscode-stable-sort/compare/v0.2.1...v0.3.0
[compound-selector]: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_selectors/Selector_structure#compound_selector
