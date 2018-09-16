'use strict';
import * as vscode from 'vscode';
import { TextEditor, Range, Selection, TextLine } from 'vscode';

//-----------------------------------------------------------------------------
export function activate(context: vscode.ExtensionContext) {
    let command: vscode.Disposable;

    command = vscode.commands.registerCommand(
        'extension.doStableLineSortAscending',
        () => { sortLines(vscode.window.activeTextEditor!, false); });
    context.subscriptions.push(command);

    command = vscode.commands.registerCommand(
        'extension.doStableLineSortDescending',
        () => { sortLines(vscode.window.activeTextEditor!, true); });
    context.subscriptions.push(command);
}

export function deactivate() {
}

//-----------------------------------------------------------------------------
export function sortLines(editor: TextEditor, descending: boolean) {
    type Datum = {
        line: TextLine,
        selection: [number, number] | undefined,
        reversed: boolean
    };
    const document = editor.document;
    const selections = editor.selections.slice()
        .sort((a, b) => a.active.compareTo(b.active));

    // Determine operations according to the options
    let compare = function (d1: Datum, d2: Datum): number {
        // Preprocess incoming data
        const range1 = d1.selection ? d1.selection : [0, d1.line.text.length];
        const range2 = d2.selection ? d2.selection : [0, d2.line.text.length];
        const str1 = d1.line.text.slice(range1[0], range1[1]).toLowerCase();
        const str2 = d2.line.text.slice(range2[0], range2[1]).toLowerCase();

        // Do the comparison
        const sign = descending ? -1 : +1;
        const diff = str1.localeCompare(str2);
        if (diff !== 0) {
            return sign * diff;
        }
        return sign * (d1.line.lineNumber - d2.line.lineNumber);  // stability
    };

    // List line numbers to be targeted
    let lineNumbers = selections.map(s => series(s.start.line, s.end.line + 1))
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
    // (2-tuple, a text line and a selection range in it)
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
                                range: intersectionInLine(s, line.range),
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
    data.sort(compare);

    return editor.edit(e => {  // Replace text
        for (var i = 0; i < lineNumbers.length; i++) {
            const datum = data[i];
            const lineNumber = lineNumbers[i];
            e.replace(document.lineAt(lineNumber).range, datum.line.text);
        }
    }).then(() => {  // Restore selections
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

function intersectionInLine(selection: Selection, range: Range): [number, number] | undefined {
    const intersection = selection.intersection(range);
    if (!intersection) {
        return;
    }
    return [intersection.start.character, intersection.end.character];
}

function series(begin: number, end: number) {
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
