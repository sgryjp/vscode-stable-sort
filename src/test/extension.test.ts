// Note: This test is leveraging the Mocha test framework (https://mochajs.org/)

import * as assert from 'assert';
import * as vscode from 'vscode';
import { Position, Range, TextEditorEdit, Selection, EndOfLine } from 'vscode';
import * as my from '../extension';


suite("sortLines()", () => {
    async function doTest(
        input: string,
        selections: Selection[],
        descending: boolean) {

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
        await my.sortLines(editor, descending);

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

    suite("single selection", () => {
        const tt: Array<[string, string, Selection[], boolean, string, Selection[]]> = [
            ["same length, ascending",
                "a,c,b", [new Selection(0, 0, 2, 1)], false,
                "a,b,c", [new Selection(0, 0, 2, 1)]],
            ["same length, descending",
                "a,c,b", [new Selection(0, 0, 2, 1)], true,
                "c,b,a", [new Selection(0, 0, 2, 1)]],
            ["different length, ascending",
                "aa,a,aaa", [new Selection(0, 0, 2, 3)], false,
                "a,aa,aaa", [new Selection(0, 0, 2, 3)]],
            ["different length, descending",
                "aa,a,aaa", [new Selection(0, 0, 2, 3)], true,
                "aaa,aa,a", [new Selection(0, 0, 2, 1)]],
            ["numeric, ascending",
                "2a,10c,,5b,", [new Selection(0, 0, 4, 0)], false,
                ",2a,5b,10c,", [new Selection(0, 0, 4, 0)]],
            ["numeric, descending",
                "2a,10c,,5b,", [new Selection(0, 0, 4, 0)], true,
                "10c,5b,2a,,", [new Selection(0, 0, 4, 0)]],
            ["compares entire line contents",
                "Apple,Orange,Grape,", [new Selection(0, 3, 2, 4)], false,
                "Apple,Grape,Orange,", [new Selection(0, 3, 2, 4)]],
        ];
        for (const t of tt) {
            const [title, input, selections, descending, xtext, xsels] = t;
            test(title, async () => {
                const result = await doTest(
                    input.replace(/,/g, "\n"), selections, descending
                );
                assert.equal(result.text.replace(/\n/g, ","), xtext);
                assert.equal(
                    stringifySelections(result.selections),
                    stringifySelections(xsels),
                );
            });
        }
    });

    suite("multiple selections", () => {
        const tt: Array<[string, string, Selection[], string, Selection[]]> = [
            ["contiguous",
                "Apple,Orange,Pineapple,", [
                    new Selection(0, 1, 0, 2),
                    new Selection(1, 1, 1, 2),
                    new Selection(2, 1, 2, 2),
                ],
                "Pineapple,Apple,Orange,", [
                    new Selection(0, 1, 0, 2),
                    new Selection(1, 1, 1, 2),
                    new Selection(2, 1, 2, 2),
                ]],
            ["sparse",
                "Apple,Orange,Grape,Pineapple,", [
                    new Selection(0, 1, 0, 3),
                    new Selection(1, 3, 1, 1),
                    new Selection(3, 1, 3, 3),
                ],
                "Pineapple,Apple,Grape,Orange,", [
                    new Selection(0, 1, 0, 3),
                    new Selection(1, 1, 1, 3),
                    new Selection(3, 3, 3, 1),
                ]],
        ];
        for (const t of tt) {
            const [title, input, selections, xtext, xsels] = t;
            test(title, async () => {
                const result = await doTest(
                    input.replace(/,/g, "\n"), selections, false
                );
                assert.equal(result.text.replace(/\n/g, ","), xtext);
                assert.equal(
                    stringifySelections(result.selections),
                    stringifySelections(xsels),
                );
            });
        }
    });

    test("stability", async () => {
        // It seems that Array.prototype.sort() of Node.js uses stable sort
        // algorithm for a small collection so the test data must be large
        // enough to let Node use the unstable algorithm.
        // As of VSCode 1.27.2 (Node.js 8.9.3), N must be larger than 5.

        // Test data was generated by Julia code below:
        // julia> N=12; A=join([('a'+floor(Int,(N-n)/2))*('A'+n-1) for n in 1:N], ",")
        // julia> join(sort(split(A, ","), by=s -> s[1]), ",")
        // julia> foreach(s -> println(s), ["new Selection($n, 0, $n, 1)," for n in 0:N-1])

        const input = "fA,fB,eC,eD,dE,dF,cG,cH,bI,bJ,aK,aL";
        const expected = "aK,aL,bI,bJ,cG,cH,dE,dF,eC,eD,fA,fB";
        let result = await doTest(
            input.replace(/,/g, "\n"), [
                new Selection(0, 0, 0, 1),
                new Selection(1, 0, 1, 1),
                new Selection(2, 0, 2, 1),
                new Selection(3, 0, 3, 1),
                new Selection(4, 0, 4, 1),
                new Selection(5, 0, 5, 1),
                new Selection(6, 0, 6, 1),
                new Selection(7, 0, 7, 1),
                new Selection(8, 0, 8, 1),
                new Selection(9, 0, 9, 1),
                new Selection(10, 0, 10, 1),
                new Selection(11, 0, 11, 1),
            ], false
        );
        assert.equal(result.text.replace(/\n/g, ","), expected);
    });

    suite("excludes last line?", () => {
        const tt: Array<[string, Selection[], string]> = [
            ["no (not single selection)",
                [new Selection(0, 0, 0, 1), new Selection(1, 0, 0, 1)],
                "foo,qux,bar"],
            ["no (not covering multiple lines)",
                [new Selection(0, 0, 0, 3)], "qux,foo,bar"],
            ["no (selection end not at the start of the lastly selected line)",
                [new Selection(0, 0, 2, 1)], "bar,foo,qux"],
            ["yes",
                [new Selection(0, 0, 2, 0)], "foo,qux,bar"],
        ];
        for (const t of tt) {
            const [title, selections, expected] = t;
            test(title, async () => {
                const result = await doTest(
                    "qux,foo,bar".replace(/,/g, "\n"), selections, false
                );
                assert.equal(result.text.replace(/\n/g, ","), expected);
            });
        }
    });
});


suite("sortWords()", () => {

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

    const tt: Array<[string, boolean, string, string]> = [
        ["delimiter: comma",
            false, "1,2,10", "1,2,10"],
        ["delimiter: comma; keep consecutive occurrence",
            false, "1,,2,10", ",1,2,10"],
        ["delimiter: comma; reproduce at most one trailing space",
            false, "1,  2,10", "1, 2, 10"],
        ["delimiter: tab",
            false, "1\t2\t10", "1\t2\t10"],
        ["delimiter: tab; keep consecutive occurrence",
            false, "1\t\t2\t10", "\t1\t2\t10"],
        ["delimiter: tab; ignore spaces after them",
            false, "1\t   2\t10", "1\t2\t10"],
        ["delimiter: pipe",
            false, "1|2|10", "1|2|10"],
        ["delimiter: pipe; keep consecutive occurrence",
            false, "1||2|10", "|1|2|10"],
        ["delimiter: pipe; reproduce at most one preceding space",
            false, "1  |2|10", "1 |2 |10"],
        ["delimiter: pipe; reproduce at most one trailing space",
            false, "1|  2|10", "1| 2| 10"],
        ["delimiter: pipe; reproduce at most one preceding & trailing space",
            false, "1  |  2|10", "1 | 2 | 10"],
        ["delimiter: space",
            false, "1 2 10", "1 2 10"],
        ["delimiter: space; treat consecutive occurrence as single occurrence",
            false, "1  2 10", "1 2 10"],
        ["delimiter: priority; ',\\t' --> ', '",
            false, "1,\t2,10", "1, 2, 10"],
        ["delimiter: priority; ',|' --> ','",
            false, "1,|2,10", "|2,1,10"],
        ["delimiter: priority; ', ' --> ', '",
            false, "1, 2,10", "1, 2, 10"],
        ["delimiter: priority; '\\t,' --> '\\t'",
            false, "1\t,2\t10", ",2\t1\t10"],
        ["delimiter: priority; '\\t|' --> '\\t'",
            false, "1\t|2\t10", "|2\t1\t10"],
        ["delimiter: priority; '\\t ' --> '\\t'",
            false, "1\t 2\t10", "1\t2\t10"],
        ["delimiter: priority; '|,' --> '|'",
            false, "1|,2|10", ",2|1|10"],
        ["delimiter: priority; '|\\t' --> '| '",
            false, "1|\t2|10", "1| 2| 10"],
        ["delimiter: priority; '| ' --> '| '",
            false, "1| 2|10", "1| 2| 10"],
        ["delimiter: priority; ' ,' --> ','",
            false, "1 ,2 10", "1,2 10"],
        ["delimiter: priority; ' \\t' --> ' '",
            false, "1 \t2 10", "1 2 10"],
        ["delimiter: priority; ' |' --> ' |'",
            false, "1 |2|10", "1 |2 |10"],
        ["options: ascending",
            false, "2,10,あ,ab,２,Ac,ア", "10,2,２,ab,Ac,あ,ア"],
        ["options: descending",
            true, "2,10,あ,ab,２,Ac,ア", "あ,ア,Ac,ab,2,２,10"],
    ];
    tt.forEach(t => {
        const [title, descending, input, expected] = t;
        test(title, async () => {
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
            const eod = editor.document.positionAt(9999);
            editor.selections = [new Selection(0, 0, eod.line, eod.character)];

            // Call the logic
            await my.sortWords(editor, descending);

            const result = {
                text: editor.document.getText(),
                selections: editor.selections
            };

            assert.equal(result.text, expected);
        });
    });

    suite("sort words spread over lines", () => {
        const tt: Array<[string, Selection[], string, Selection[], string]> = [
            ["case 1",
                [new Selection(0, 7, 2, 9)],
                "export orange,\n  apple, pineapple,\n    grape",
                [new Selection(0, 7, 2, 13)],
                "export apple, \n  grape, orange, \n    pineapple",
            ],
        ];
        for (const t of tt) {
            const [title, sels, str, xsels, xstr] = t;
            test(title, async () => {
                // Set the test input text and the selection
                const editor = vscode.window.activeTextEditor!;
                await editor.edit((editBuilder: TextEditorEdit) => {
                    const document = editor.document;
                    const lastLine = document.lineAt(document.lineCount - 1);
                    const entireRange = new Range(
                        new Position(0, 0),
                        lastLine.range.end
                    );
                    editBuilder.replace(entireRange, str);
                });
                editor.selections = sels;

                // Call the logic
                await my.sortWords(editor, false);
                const result = {
                    text: editor.document.getText(),
                    selections: editor.selections
                };

                assert.equal(result.text, xstr);
                assert.equal(
                    stringifySelections(result.selections),
                    stringifySelections(xsels),
                );
            });
        }
    });
});


function stringifySelections(selections: Selection[]): string {
    return '[' + selections
        .map(s => [s.anchor.line, s.anchor.character, s.active.line, s.active.character])
        .sort()
        .map(s => '(' + s.join(',') + ')')
        .join(',') + ']';
}
