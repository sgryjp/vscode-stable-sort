'use strict';
import * as vscode from 'vscode';
import { TextEditor, Range, Selection, TextLine } from 'vscode';

//-----------------------------------------------------------------------------
export function activate(context: vscode.ExtensionContext) {
    let command: vscode.Disposable;

    command = vscode.commands.registerCommand(
        'stableSort.sortLinesAscending', () => {
            sortLines(vscode.window.activeTextEditor!,
                false, false
            );
        });
    context.subscriptions.push(command);

    command = vscode.commands.registerCommand(
        'stableSort.sortLinesDescending', () => {
            sortLines(vscode.window.activeTextEditor!,
                true, false
            );
        });
    context.subscriptions.push(command);

    command = vscode.commands.registerCommand(
        'stableSort.sortLinesAscendingNumerically', () => {
            sortLines(vscode.window.activeTextEditor!,
                false, true
            );
        });
    context.subscriptions.push(command);

    command = vscode.commands.registerCommand(
        'stableSort.sortLinesDescendingNumerically', () => {
            sortLines(vscode.window.activeTextEditor!,
                true, true
            );
        });
    context.subscriptions.push(command);

    command = vscode.commands.registerCommand(
        'stableSort.sortWordsAscending', () => {
            sortWords(vscode.window.activeTextEditor!, false);
        });
    context.subscriptions.push(command);

    command = vscode.commands.registerCommand(
        'stableSort.sortWordsDescending', () => {
            sortWords(vscode.window.activeTextEditor!, true);
        });
    context.subscriptions.push(command);
}

export function deactivate() {
}

//-----------------------------------------------------------------------------
export function sortLines(
    editor: TextEditor,
    descending: boolean,
    numeric: boolean
) {
    type Datum = {
        selection: Range,
        reversed: boolean
    };
    const document = editor.document;
    const selections = editor.selections.slice()
        .sort((a, b) => a.active.compareTo(b.active));

    // List line numbers to be targeted
    let lineNumberSet = new Set<number>();
    for (const s of selections) {
        for (var i = s.start.line; i <= s.end.line; i++) {
            lineNumberSet.add(i);
        }
    }
    let lineNumbers = Array.from(lineNumberSet);
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
    let data: Array<Datum> = [];
    for (const lineNumber of lineNumbers) {
        const line = document.lineAt(lineNumber);
        let range: Range;
        let reversed: boolean = false;
        for (const s of selections) {
            const r = s.intersection(line.range);
            if (r !== undefined) {
                range = r!;
                reversed = s.isReversed;
                break;
            }
        }
        data.push({
            selection: range!,
            reversed: reversed,
        });
    }

    // Sort
    data.sort((d1: Datum, d2: Datum) => {
        // Get substrings to compare
        let str1: string;
        let str2: string;
        if (1 < selections.length) {
            str1 = document.getText(d1.selection);
            str2 = document.getText(d2.selection);
        } else {
            str1 = document.lineAt(d1.selection.start.line).text;
            str2 = document.lineAt(d2.selection.start.line).text;
        }

        // Compare by text
        const diff = _compare(str1, str2, numeric);
        if (diff !== 0) {
            return descending ? -diff : +diff;
        }

        // Compare by line number (do not reverse the sign)
        return d1.selection.start.line - d2.selection.start.line;
    });

    return editor.edit(e => {  // Replace text
        for (var i = 0; i < lineNumbers.length; i++) {
            const datum = data[i];
            const lineNumber = lineNumbers[i];
            e.replace(
                document.lineAt(lineNumber).range,
                document.lineAt(datum.selection.start.line).text,
            );
        }
    }).then(() => {  // Restore selections
        if (selections.length === 1) {
            return true;  // VSCode restores selection well if there's only one
        }
        let newSelections = new Array<Selection>();
        for (var i = 0; i < lineNumbers.length; i++) {
            const datum = data[i];
            const lineNumber = lineNumbers[i];
            let s: Selection;
            if (datum.reversed) {
                s = new Selection(
                    lineNumber, datum.selection.end.character,
                    lineNumber, datum.selection.start.character
                );
            } else {
                s = new Selection(
                    lineNumber, datum.selection.start.character,
                    lineNumber, datum.selection.end.character,
                );
            }
            newSelections.push(s);
        }
        editor.selections = newSelections;
    });
}

export function sortWords(
    editor: TextEditor,
    descending: boolean
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
    const [sepPattern, sepText] = _guessSeparator(selectedText);

    // Separate words with it and sort them
    const sign = descending ? -1 : +1;
    const words = selectedText
        .split(sepPattern)
        .map(w => w.trim());
    const numeric = words
        .map(w => !isNaN(parseFloat(w)) || w.trim() === "")
        .reduce((prev, curr) => prev && curr);

    words.sort((a, b) => sign * _compare(a, b, numeric));

    // Compose sorted text
    let newText = words.join(sepText);
    if (1 < selectedText.length &&
        sepPattern.test(selectedText[selectedText.length - 1])) {
        // Keep trailing separator if there was
        newText += sepText;
    }

    // Apply
    return editor.edit(e => {
        e.replace(selection, newText);
    });
}

function _compare(str1: string, str2: string, numeric: boolean): number {
    const locale = vscode.env.language;
    const options = { numeric: numeric };
    return str1.localeCompare(str2, locale, options);
}

function _guessSeparator(text: string): [RegExp, string] {
    let matches = text.match(/^[^,\t\|]+,(\s*)(?:[^,]+,\s*)*/);
    if (matches) {
        return [/,\s*/, matches[1] !== "" ? ", " : ","];
    }

    matches = text.match(/^[^\t\s\|]+\t+(?:[^\t]+\t+)*/);
    if (matches) {
        return [/\t[ \n\r]*/, "\t"];
    }

    matches = text.match(/^[^\s\|]+(\s*)\|(\s*)(?:[^\|]+\|\s*)*/);
    if (matches) {
        const pre = matches[1] !== "" ? " " : "";
        const post = matches[2] !== "" ? " " : "";
        return [/\|\s*/, pre + "|" + post];
    }

    return [/\s+/, " "];
}
