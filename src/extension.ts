'use strict';
import * as vscode from 'vscode';
import { TextEditor, Selection } from 'vscode';
import { computeWidth } from "meaw";

//-----------------------------------------------------------------------------
export function activate(context: vscode.ExtensionContext) {
    let command: vscode.Disposable;

    command = vscode.commands.registerCommand(
        'stableSort.sortAscending', () => {
            sort(vscode.window.activeTextEditor!, false);
        });
    context.subscriptions.push(command);

    command = vscode.commands.registerCommand(
        'stableSort.sortDescending', () => {
            sort(vscode.window.activeTextEditor!, true);
        });
    context.subscriptions.push(command);
}

export function deactivate() {
}

//-----------------------------------------------------------------------------
export function sort(
    editor: TextEditor,
    descending: boolean
) {
    const selection = editor.selection;
    if (1 < editor.selections.length ||
        (selection.start.character === 0 && selection.end.character === 0)) {
        return sortLines(editor, descending);
    } else {
        return sortWords(editor, descending);
    }
}

export function sortLines(
    editor: TextEditor,
    descending: boolean
) {
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
    let selectionsPerLine: Array<Selection> = [];
    for (const lineNumber of lineNumbers) {
        const line = document.lineAt(lineNumber);
        for (const s of selections) {
            const r = s.intersection(line.range);
            if (r !== undefined) {
                selectionsPerLine.push(
                    s.isReversed
                        ? new Selection(r!.end, r!.start)
                        : new Selection(r!.start, r!.end),
                );
                break;
            }
        }
    }

    // Sort
    selectionsPerLine.sort((s1: Selection, s2: Selection) => {
        // Get substrings to compare
        let str1: string;
        let str2: string;
        if (1 < selections.length) {
            str1 = document.getText(s1);
            str2 = document.getText(s2);
        } else {
            str1 = document.lineAt(s1.start.line).text;
            str2 = document.lineAt(s2.start.line).text;
        }

        // Check if they start with a word looking like a numeric value
        const numeric = (
            (str1.trim() === "" || !isNaN(parseFloat(str1))) &&
            (str2.trim() === "" || !isNaN(parseFloat(str2)))
        );

        // Compare by text
        const diff = _compare(str1, str2, numeric);
        if (diff !== 0) {
            return descending ? -diff : +diff;
        }

        // Compare by line number (do not reverse the sign)
        return s1.start.line - s2.start.line;
    });

    return editor.edit(e => {  // Replace text
        for (var i = 0; i < lineNumbers.length; i++) {
            const selection = selectionsPerLine[i];
            const lineNumber = lineNumbers[i];
            e.replace(
                document.lineAt(lineNumber).range,
                document.lineAt(selection.start.line).text,
            );
        }
    }).then(() => {  // Restore selections
        if (selections.length === 1) {
            return true;  // VSCode restores selection well if there's only one
        }
        let newSelections = new Array<Selection>();
        for (var i = 0; i < lineNumbers.length; i++) {
            const selection = selectionsPerLine[i];
            const lineNumber = lineNumbers[i];
            newSelections.push(new Selection(
                lineNumber, selection.anchor.character,
                lineNumber, selection.active.character,
            ));
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

    if (1 < editor.selections.length) {
        vscode.window.showInformationMessage(
            "Sorting words in multiple selections are not supported."
        );
        return;
    }

    // Collect indentation and width of each line
    let indents: Array<string> = [""];
    let widths: Array<number> = [
        computeWidth(
            document.lineAt(selection.start.line)
                .text
                .substring(selection.start.character)
        )
    ];
    for (let i = selection.start.line + 1; i <= selection.end.line; i++) {
        const lineText = document.lineAt(i).text;
        const firstNonSpaceCharIndex = lineText.search(/[^\s]/);
        const indent = lineText.substring(0, firstNonSpaceCharIndex);
        indents.push(indent);
        widths.push(computeWidth(lineText));
    }

    // Get firstly used separator character in the selection
    const selectedText = document.getText(selection).replace("\n", "").trim();
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

    // Compose new text according to the rules below:
    // 1. Keep indentations
    // 2. For each line, place words in sorted order until placing a word makes
    //    the line longer than the original
    // 3. Exceptionally, at least one word must be place for each line
    // 4. Append words which were not accommodated within the original space
    let lines: Array<string> = [];
    let j = 0;
    for (let i = 0; i < indents.length; i++) {
        // Add the first word
        let line = indents[i] + words[j++] + sepText;

        // Append following words until it reaches the maximum column position
        while (j < words.length && line.length + words[j].length <= widths[i]) {
            line += words[j++] + sepText;
        }

        // Push the composed line
        lines.push(line);
    }

    // Concat remaining words to the last line
    while (j < words.length) {
        lines[lines.length - 1] += words[j++] + sepText;
    }
    let newText = lines.join("\n");
    newText = newText.substring(0, newText.length - sepText.length);

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
    // CSV?
    let matches = text.match(/^[^,\t\|]+,(\s*)(?:[^,]+,\s*)*/);
    if (matches) {
        return [/,\s*/, matches[1] !== "" ? ", " : ","];
    }

    // TSV?
    matches = text.match(/^[^\t\s\|]+\t+(?:[^\t]+\t+)*/);
    if (matches) {
        return [/\t[ \n\r]*/, "\t"];
    }

    // Separated with pipe (vertical bar)?
    matches = text.match(/^[^\s\|]+(\s*)\|(\s*)(?:[^\|]+\|\s*)*/);
    if (matches) {
        const pre = matches[1] !== "" ? " " : "";
        const post = matches[2] !== "" ? " " : "";
        return [/\|\s*/, pre + "|" + post];
    }

    // Then we treat this as space delimited fields
    return [/\s+/, " "];
}
