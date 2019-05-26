// Note: This test is leveraging the Mocha test framework (https://mochajs.org/)

import * as assert from 'assert';
import * as vscode from 'vscode';
import { Position, Range, TextEditorEdit, Selection, EndOfLine } from 'vscode';
import * as my from '../extension';


suite("sortLines()", () => {
    async function doTest(
        input: string,
        selections: Selection[],
        descending: boolean,
        mode: my.Mode) {

        // Set the test input text and the selection
        const editor = vscode.window.activeTextEditor!;
        await editor.edit((editBuilder: TextEditorEdit) => {
            const document = editor.document;
            const lastLine = document.lineAt(document.lineCount - 1);
            const entireRange = new Range(
                new Position(0, 0),
                lastLine.range.end
            );
            editBuilder.replace(entireRange, input);
        });
        editor.selections = selections;

        // Call the logic
        await my.sortLines(editor, descending, mode);

        // Return the result
        return { text: editor.document.getText(), selections: editor.selections };
    }

    suiteSetup(async () => {
        const uri = vscode.Uri.parse("untitled:test.txt");
        const options = { preserveFocus: false };
        const editor = await vscode.window.showTextDocument(uri, options);
        await editor.edit(edit => {
            edit.setEndOfLine(EndOfLine.LF);
        });
    });

    suiteTeardown(async () => {
        const commandName = "workbench.action.closeAllEditors";
        await vscode.commands.executeCommand(commandName);
    });

    test("prerequesties", async () => {
        // full-icu package
        const halfWidthOne = "1";
        const fullWidthOne = "\uff11";
        assert.ok(
            halfWidthOne.localeCompare(fullWidthOne, "ja") === 0,
            "Locale aware string comparison failed." +
            " Full ICU data must be installed on the test environment. See" +
            " https://www.npmjs.com/package/full-icu"
        );
    });

    test("single selection: logic", async () => {
        let result = await doTest(
            "a\n" +
            "c\n" +
            "b\n",
            [new Selection(0, 0, 3, 0)],
            false, ""
        );
        assert.equal(result.text,
            "a\n" +
            "b\n" +
            "c\n"
        );
        assert.equal(stringifySelections(result.selections),
            stringifySelections([new Selection(0, 0, 3, 0)])
        );

        result = await doTest(
            "aaa\n" +
            "aa\n" +
            "a\n",
            [new Selection(0, 0, 3, 0)],
            false, ""
        );
        assert.equal(result.text,
            "a\n" +
            "aa\n" +
            "aaa\n"
        );
        assert.equal(stringifySelections(result.selections),
            stringifySelections([new Selection(0, 0, 3, 0)])
        );
    });

    test("single selection: always compare entire line content", async () => {
        let result = await doTest(
            "Apple\n" +
            "Orange\n" +
            "Grape\n",
            [new Selection(0, 3, 2, 4)],
            false, ""
        );
        assert.equal(result.text,
            "Apple\n" +
            "Grape\n" +
            "Orange\n"
        );
        assert.equal(stringifySelections(result.selections),
            stringifySelections([new Selection(0, 3, 2, 4)])
        );
    });

    test("multiple selections: contiguous", async () => {
        let result = await doTest(
            "Apple\n" +
            "Orange\n" +
            "Pineapple\n",
            [
                new Selection(0, 1, 0, 2),
                new Selection(1, 1, 1, 2),
                new Selection(2, 1, 2, 2),
            ],
            false, ""
        );
        assert.equal(result.text,
            "Pineapple\n" +
            "Apple\n" +
            "Orange\n"
        );
        assert.equal(stringifySelections(result.selections),
            stringifySelections([
                new Selection(0, 1, 0, 2),
                new Selection(1, 1, 1, 2),
                new Selection(2, 1, 2, 2),
            ])
        );
    });

    test("multiple selections: sparse", async () => {
        let result = await doTest(
            "Apple\n" +
            "Orange\n" +
            "Grape\n" +
            "Pineapple\n",
            [
                new Selection(0, 1, 0, 3),
                new Selection(1, 3, 1, 1),
                new Selection(3, 1, 3, 3),
            ],
            false, ""
        );
        assert.equal(result.text,
            "Pineapple\n" +
            "Apple\n" +
            "Grape\n" +
            "Orange\n"
        );
        assert.equal(stringifySelections(result.selections),
            stringifySelections([
                new Selection(0, 1, 0, 3),
                new Selection(1, 1, 1, 3),
                new Selection(3, 3, 3, 1),
            ])
        );
    });

    test("descending order", async () => {
        let result = await doTest(
            "a\n" +
            "c\n" +
            "b\n",
            [new Selection(0, 0, 3, 0)],
            true, ""
        );
        assert.equal(result.text,
            "c\n" +
            "b\n" +
            "a\n"
        );
        assert.equal(stringifySelections(result.selections),
            stringifySelections([new Selection(0, 0, 3, 0)]),
        );

        result = await doTest(
            "a\n" +
            "aa\n" +
            "aaa\n",
            [new Selection(0, 0, 3, 0)],
            true, ""
        );
        assert.equal(result.text,
            "aaa\n" +
            "aa\n" +
            "a\n"
        );
        assert.equal(stringifySelections(result.selections),
            stringifySelections([new Selection(0, 0, 3, 0)]),
        );
    });

    test("empty line: exclude trailing one in a selection", async () => {
        let result = await doTest(
            "a\n" +
            "c\n" +
            "b\n" +
            "\n",
            [new Selection(0, 0, 3, 0)],
            false, ""
        );
        assert.equal(result.text,
            "a\n" +
            "b\n" +
            "c\n" +
            "\n"
        );
        assert.equal(stringifySelections(result.selections),
            stringifySelections([new Selection(0, 0, 3, 0)]),
        );
    });

    test("empty line: include those selected by one of the multiple selections", async () => {
        let result = await doTest(
            "b\n" +
            "\n" +
            "a\n" +
            "\n",
            [
                new Selection(0, 0, 0, 1),
                new Selection(1, 0, 1, 0),
                new Selection(2, 0, 2, 1),
            ],
            false, ""
        );
        assert.equal(result.text,
            "\n" +
            "a\n" +
            "b\n" +
            "\n"
        );
        assert.equal(stringifySelections(result.selections),
            stringifySelections([
                new Selection(0, 0, 0, 0),
                new Selection(1, 0, 1, 1),
                new Selection(2, 0, 2, 1),
            ])
        );
    });

    test("stability", async () => {
        // It seems that Array.prototype.sort() of Node.js uses stable sort
        // algorithm for a small collection so the test data must be large
        // enough to let Node use the unstable algorithm.
        // As of VSCode 1.27.2 (Node.js 8.9.3), N must be larger than 5.
        const N = 6;
        const input = Array<string>();
        for (let i = 0; i < N; i++) {
            input.push(String.fromCharCode('A'.charCodeAt(0) + N - 1 - i));
            input.push(String.fromCharCode('Ａ'.charCodeAt(0) + N - 1 - i));
        }

        const expected = Array<string>();
        for (let i = 0; i < N; i++) {
            expected.push(String.fromCharCode('A'.charCodeAt(0) + i));
            expected.push(String.fromCharCode('Ａ'.charCodeAt(0) + i));
        }

        let result = await doTest(
            input.join("\n") + "\n",
            [new Selection(0, 0, N * 2, 0)],
            false, ""
        );
        assert.equal(result.text,
            expected.join("\n") + "\n"
        );
    });

    // Collate options
    [
        { descending: false, mode: "", expected: "10,2,２,ab,Ac,あ,ア" },
        { descending: false, mode: "n", expected: "2,２,10,ab,Ac,あ,ア" },
        { descending: true, mode: "", expected: "あ,ア,Ac,ab,2,２,10" },
        { descending: true, mode: "n", expected: "あ,ア,Ac,ab,10,2,２" },
    ].forEach(t => {
        const input = "2,10,あ,ab,２,Ac,ア";
        test(`options: {descending: ${t.descending}, mode: "${t.mode}"}`,
            async () => {
                const result = await doTest(
                    input.replace(/,/g, "\n"),
                    [new Selection(0, 0, 6, 1)],
                    t.descending,
                    t.mode as my.Mode
                );
                assert.equal(result.text.replace(/\n/g, ","), t.expected);
            });
    });
});


suite("sortWords()", () => {
    async function doTest(
        input: string,
        selections: Selection[],
        descending: boolean,
        mode: my.Mode) {

        // Set the test input text and the selection
        const editor = vscode.window.activeTextEditor!;
        await editor.edit((editBuilder: TextEditorEdit) => {
            const document = editor.document;
            const lastLine = document.lineAt(document.lineCount - 1);
            const entireRange = new Range(
                new Position(0, 0),
                lastLine.range.end
            );
            editBuilder.replace(entireRange, input);
        });
        editor.selections = selections;

        // Call the logic
        await my.sortWords(editor, descending, mode);

        // Return the result
        return { text: editor.document.getText(), selections: editor.selections };
    }

    suiteSetup(async () => {
        const uri = vscode.Uri.parse("untitled:test.txt");
        const options = { preserveFocus: false };
        const editor = await vscode.window.showTextDocument(uri, options);
        await editor.edit(edit => {
            edit.setEndOfLine(EndOfLine.LF);
        });
    });

    suiteTeardown(async () => {
        const commandName = "workbench.action.closeAllEditors";
        await vscode.commands.executeCommand(commandName);
    });

    test("delimiter: csv-like", async () => {
        let result = await doTest(
            "1, 2,10",
            [new Selection(0, 0, 0, 7)],
            false, ""
        );
        assert.equal(result.text,
            "1, 10, 2"
        );
        assert.equal(stringifySelections(result.selections),
            stringifySelections([new Selection(0, 0, 0, 8)])
        );
    });

    test("delimiter: space", async () => {
        let result = await doTest(
            "1 2 10",
            [new Selection(0, 0, 0, 6)],
            false, ""
        );
        assert.equal(result.text,
            "1 10 2"
        );
        assert.equal(stringifySelections(result.selections),
            stringifySelections([new Selection(0, 0, 0, 6)])
        );
    });

    // Collate options
    [
        { descending: false, mode: "", expected: "10,2,２,ab,Ac,あ,ア" },
        { descending: false, mode: "n", expected: "2,２,10,ab,Ac,あ,ア" },
        { descending: true, mode: "", expected: "あ,ア,Ac,ab,2,２,10" },
        { descending: true, mode: "n", expected: "あ,ア,Ac,ab,10,2,２" },
    ].forEach(t => {
        const input = "2,10,あ,ab,２,Ac,ア";
        test(`options: {descending: ${t.descending}, mode: "${t.mode}"}`,
            async () => {
                const result = await doTest(
                    input,
                    [new Selection(0, 0, 0, 16)],
                    t.descending,
                    t.mode as my.Mode
                );
                assert.equal(result.text, t.expected);
            });
    });
});


function stringifySelections(selections: Selection[]): string {
    return '[' + selections
        .map(s => [s.anchor.line, s.anchor.character, s.active.line, s.active.character])
        .sort()
        .map(s => '(' + s.join(',') + ')')
        .join(',') + ']';
}
