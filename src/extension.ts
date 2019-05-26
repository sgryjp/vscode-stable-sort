'use strict';
import * as vscode from 'vscode';
import { TextEditor, Range, Selection, TextLine } from 'vscode';

//-----------------------------------------------------------------------------
export function activate(context: vscode.ExtensionContext) {
    let command: vscode.Disposable;

    command = vscode.commands.registerCommand(
        'stableSort.sortLinesAscending', () => {
            sortLines(vscode.window.activeTextEditor!,
                false, ""
            );
        });
    context.subscriptions.push(command);

    command = vscode.commands.registerCommand(
        'stableSort.sortLinesDescending', () => {
            sortLines(vscode.window.activeTextEditor!,
                true, ""
            );
        });
    context.subscriptions.push(command);

    command = vscode.commands.registerCommand(
        'stableSort.sortLinesAscendingNumerically', () => {
            sortLines(vscode.window.activeTextEditor!,
                false, "n"
            );
        });
    context.subscriptions.push(command);

    command = vscode.commands.registerCommand(
        'stableSort.sortLinesDescendingNumerically', () => {
            sortLines(vscode.window.activeTextEditor!,
                true, "n"
            );
        });
    context.subscriptions.push(command);

    command = vscode.commands.registerCommand(
        'stableSort.sortWordsAscending', () => {
            sortWords(vscode.window.activeTextEditor!,
                false, ""
            );
        });
    context.subscriptions.push(command);

    command = vscode.commands.registerCommand(
        'stableSort.sortWordsDescending', () => {
            sortWords(vscode.window.activeTextEditor!,
                true, ""
            );
        });
    context.subscriptions.push(command);

    command = vscode.commands.registerCommand(
        'stableSort.sortWordsAscendingNumerically', () => {
            sortWords(vscode.window.activeTextEditor!,
                false, "n"
            );
        });
    context.subscriptions.push(command);

    command = vscode.commands.registerCommand(
        'stableSort.sortWordsDescendingNumerically', () => {
            sortWords(vscode.window.activeTextEditor!,
                true, "n"
            );
        });
    context.subscriptions.push(command);
}

export function deactivate() {
}

//-----------------------------------------------------------------------------
export type Mode = "n" | "";

export function sortLines(
    editor: TextEditor,
    descending: boolean,
    mode: Mode
) {
    type Datum = {
        line: TextLine,
        selection: [number, number] | undefined,
        reversed: boolean
    };
    const document = editor.document;
    const selections = editor.selections.slice()
        .sort((a, b) => a.active.compareTo(b.active));

    // List line numbers to be targeted
    let lineNumbers = selections
        .map(s => _series(s.start.line, s.end.line + 1))
        .reduce((prev, curr) => prev.concat(curr))  // flatten
        .reduce((prev, curr) => {  // unique
            if (prev.length === 0 || prev[prev.length - 1] !== curr) {
                prev.push(curr);
            }
            return prev;
        }, new Array<number>());
    if (1 === selections.length && 1 < lineNumbers.length) {
        // Exclude last line if there is only one selection which ends at
        // start of a line
        const lastSelection = selections[selections.length - 1];
        const lastLine = document.lineAt(lineNumbers[lineNumbers.length - 1]);
        if (lastSelection.end.isEqual(lastLine.range.start)) {
            lineNumbers.pop();
        }
    }

    // Prepare data to process
    // (An array of 3-tuples made with TextLine object, selection range,
    // and whether the selection is reversed or not)
    const data: Datum[] = lineNumbers
        .map(lineNumber => document.lineAt(lineNumber))
        .map(line => ({
            line: line,
            selection:
                _first(
                    _filter(
                        _map(
                            selections,
                            s => ({
                                range: _intersection(s, line.range),
                                reversed: s.isReversed
                            })
                        ),
                        x => x.range !== undefined
                    )
                ),
        }))
        .map(x => ({
            line: x.line,
            selection: x.selection ? x.selection.range : undefined,
            reversed: x.selection ? x.selection.reversed : false,
        }));

    // Sort
    data.sort((d1: Datum, d2: Datum) => {
        // Preprocess incoming data
        const range1 = d1.selection ? d1.selection : [0, d1.line.text.length];
        const range2 = d2.selection ? d2.selection : [0, d2.line.text.length];
        let str1 = d1.line.text;
        let str2 = d2.line.text;
        if (1 < selections.length) {
            str1 = str1.slice(range1[0], range1[1]).toLowerCase();
            str2 = str2.slice(range2[0], range2[1]).toLowerCase();
        }

        // Compare by text
        const diff = _compare(str1, str2, mode);
        if (diff !== 0) {
            return descending ? -diff : +diff;
        }

        // Compare by line number (do not reverse the sign)
        return d1.line.lineNumber - d2.line.lineNumber;
    });

    return editor.edit(e => {  // Replace text
        for (var i = 0; i < lineNumbers.length; i++) {
            const datum = data[i];
            const lineNumber = lineNumbers[i];
            e.replace(document.lineAt(lineNumber).range, datum.line.text);
        }
    }).then(() => {  // Restore selections
        if (selections.length === 1) {
            return true;  // VSCode restores selection well if there's only one
        }
        let newSelections = new Array<Selection>();
        for (var i = 0; i < lineNumbers.length; i++) {
            const datum = data[i];
            const lineNumber = lineNumbers[i];
            if (datum.selection) {
                const s = new Selection(
                    lineNumber,
                    datum.reversed ? datum.selection[1] : datum.selection[0],
                    lineNumber,
                    datum.reversed ? datum.selection[0] : datum.selection[1]
                );
                newSelections.push(s);
            }
        }
        editor.selections = newSelections;
    });
}

export function sortWords(
    editor: TextEditor,
    descending: boolean,
    mode: Mode
) {
    const document = editor.document;
    const selection = editor.selection;

    //TODO: Support sorting words spread over multiple lines
    if (editor.selections.length !== 1 || !editor.selection.isSingleLine) {
        vscode.window.showInformationMessage(
            "Sorry, sorting words in multiple lines/selections are" +
            " not supported yet..."
        );
        return;
    }

    // Get firstly used separator character in the selection
    const selectedText = document.getText(selection).trim();
    const [separator, withSpace] = _getSeparatorAndPadding(selectedText);

    // Separate words with it and sort them
    const sign = descending ? -1 : +1;
    const words = selectedText
        .split(separator)
        .map(w => w.trim())
        .filter(w => 0 < w.length);
    words.sort((a, b) => sign * _compare(a, b, mode));

    // Compose sorted text
    let newText = words.join(separator + (withSpace ? " " : ""));
    if (1 < selectedText.length &&
        selectedText[selectedText.length - 1] === separator) {
        // Keep trailing separator if there was
        newText += separator;
    }

    // Apply
    return editor.edit(e => {
        e.replace(selection, newText);
    });
}

function _compare(str1: string, str2: string, mode: Mode): number {
    const locale = vscode.env.language;
    const options = { numeric: mode === "n" };
    return str1.localeCompare(str2, locale, options);
}

function _intersection(
    selection: Selection,
    range: Range
): [number, number] | undefined {
    const intersection = selection.intersection(range);
    if (!intersection) {
        return;
    }
    return [intersection.start.character, intersection.end.character];
}

function _getSeparatorAndPadding(text: string): [string, boolean] {
    let matches = text.match(/^[^,]+,(\s*)(?:[^,]+,\s*)*[^,]+/);
    if (matches) {
        return [",", matches[1] !== ""];
    }

    matches = text.match(/^[^\t]+\t(\s*)(?:[^\t]+\t\s*)*[^\t]+/);
    if (matches) {
        return ["\t", matches[1] !== ""];
    }

    matches = text.match(/^[^\|]+\|(\s*)(?:[^\|]+\|\s*)*[^\|]+/);
    if (matches) {
        return ["|", matches[1] !== ""];
    }

    return [" ", false];
}

function _series(begin: number, end: number) {
    return Array.from({ length: end - begin }, (v, i) => begin + i);
}

function _first<T>(iterable: Iterable<T>): T | undefined {
    for (var item of iterable) {
        return item;
    }
}

function* _map<T, U>(iterable: Iterable<T>, op: (value: T, index: number) => U) {
    let i = 0;
    for (var item of iterable) {
        yield op(item, i++);
    }
}

function* _filter<T>(iterable: Iterable<T>, op: (value: T) => boolean) {
    for (var item of iterable) {
        if (op(item)) {
            yield item;
        }
    }
}
