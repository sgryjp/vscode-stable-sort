import * as assert from "assert";
import * as vscode from "vscode";
import { EndOfLine, Position, Range, Selection, TextEditorEdit } from "vscode";
import * as my from "../../extension";

suite("sortLines()", () => {
  async function doTest(
    input: string,
    selections: Selection[],
    descending: boolean,
  ) {
    // Set the test input text and the selection
    const editor = vscode.window.activeTextEditor!;
    await editor.edit((editBuilder: TextEditorEdit) => {
      const document = editor.document;
      const lastLine = document.lineAt(document.lineCount - 1);
      const entireRange = new Range(new Position(0, 0), lastLine.range.end);
      editBuilder.replace(entireRange, input);
    });
    editor.selections = selections;

    // Call the logic
    await my.sortLines(editor, descending);

    // Return the result
    return { text: editor.document.getText(), selections: editor.selections };
  }

  suiteSetup(async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: "Plain Text",
      content: "",
    });
    const editor = await vscode.window.showTextDocument(doc);
    await editor.edit((edit) => {
      edit.setEndOfLine(EndOfLine.LF);
    });
  });

  suiteTeardown(async () => {
    const commandName = "workbench.action.closeAllEditors";
    await vscode.commands.executeCommand(commandName);
  });

  test("prerequisites", async () => {
    // full-icu package
    const halfWidthOne = "1";
    const fullWidthOne = "\uff11";
    assert.ok(
      halfWidthOne.localeCompare(fullWidthOne, "ja") === 0,
      "Locale aware string comparison failed." +
        " Full ICU data must be installed on the test environment. See" +
        " https://www.npmjs.com/package/full-icu",
    );
  });

  suite("single selection", () => {
    // prettier-ignore
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
      const [title, input, selections, descending, xText, xSelections] = t;
      test(title, async () => {
        const result = await doTest(
          input.replace(/,/g, "\n"),
          selections,
          descending,
        );
        assert.strictEqual(result.text.replace(/\n/g, ","), xText);
        assert.strictEqual(
          stringifySelections(result.selections),
          stringifySelections(xSelections),
        );
      });
    }
  });

  suite("multiple selections", () => {
    // prettier-ignore
    const tt: Array<[string, string, Selection[], string, Selection[]]> = [
      ["contiguous",
        "Apple,Orange,Pineapple,",
        [
          new Selection(0, 1, 0, 2),
          new Selection(1, 1, 1, 2),
          new Selection(2, 1, 2, 2),
        ],
        "Pineapple,Apple,Orange,",
        [
          new Selection(0, 1, 0, 2),
          new Selection(1, 1, 1, 2),
          new Selection(2, 1, 2, 2),
        ],
      ],
      ["sparse",
        "Apple,Orange,Grape,Pineapple,",
        [
          new Selection(0, 1, 0, 3),
          new Selection(1, 3, 1, 1),
          new Selection(3, 1, 3, 3),
        ],
        "Pineapple,Apple,Grape,Orange,",
        [
          new Selection(0, 1, 0, 3),
          new Selection(1, 1, 1, 3),
          new Selection(3, 3, 3, 1),
        ],
      ],
    ];
    for (const t of tt) {
      const [title, input, selections, xText, xSelections] = t;
      test(title, async () => {
        const result = await doTest(
          input.replace(/,/g, "\n"),
          selections,
          false,
        );
        assert.strictEqual(result.text.replace(/\n/g, ","), xText);
        assert.strictEqual(
          stringifySelections(result.selections),
          stringifySelections(xSelections),
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
      input.replace(/,/g, "\n"),
      [
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
      ],
      false,
    );
    assert.strictEqual(result.text.replace(/\n/g, ","), expected);
  });

  suite("excludes last line?", () => {
    // prettier-ignore
    const tt: Array<[string, Selection[], string]> = [
      ["no (not single selection)",
        [new Selection(0, 0, 0, 1), new Selection(1, 0, 0, 1)],
        "foo,qux,bar",
      ],
      ["no (not covering multiple lines)",
        [new Selection(0, 0, 0, 3)],
        "qux,foo,bar",
      ],
      ["no (selection end not at the start of the lastly selected line)",
        [new Selection(0, 0, 2, 1)],
        "bar,foo,qux",
      ],
      ["yes",
        [new Selection(0, 0, 2, 0)],
        "foo,qux,bar"],
    ];
    for (const t of tt) {
      const [title, selections, expected] = t;
      test(title, async () => {
        const result = await doTest(
          "qux,foo,bar".replace(/,/g, "\n"),
          selections,
          false,
        );
        assert.strictEqual(result.text.replace(/\n/g, ","), expected);
      });
    }
  });
});

suite("sortWords()", () => {
  suiteSetup(async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: "Plain Text",
      content: "",
    });
    const editor = await vscode.window.showTextDocument(doc);
    await editor.edit((edit) => {
      edit.setEndOfLine(EndOfLine.LF);
    });
  });

  suiteTeardown(async () => {
    const commandName = "workbench.action.closeAllEditors";
    await vscode.commands.executeCommand(commandName);
  });

  // prettier-ignore
  const tt: Array<[string, boolean, boolean, string, string]> = [
    ["delimiter: comma",
      false, true, "1,2,10", "1,2,10"],
    ["delimiter: comma; consecutive occurrence indicates an empty field",
      false, true, "1,,2,10", ",1,2,10"],
    ["delimiter: comma; reproduce at most one trailing space",
      false, true, "1,  2,10", "1, 2, 10"],
    ["delimiter: tab",
      false, true, "1\t2\t10", "1\t2\t10"],
    ["delimiter: tab; consecutive occurrence indicates an empty field",
      false, true, "1\t\t2\t10", "\t1\t2\t10"],
    ["delimiter: tab; ignore spaces after them",
      false, true, "1\t   2\t10", "1\t2\t10"],
    ["delimiter: pipe",
      false, true, "1|2|10", "1|2|10"],
    ["delimiter: pipe; consecutive occurrence indicates an empty field",
      false, true, "1||2|10", "|1|2|10"],
    ["delimiter: pipe; reproduce at most one preceding space",
      false, true, "1  |2|10", "1 |2 |10"],
    ["delimiter: pipe; reproduce at most one trailing space",
      false, true, "1|  2|10", "1| 2| 10"],
    ["delimiter: pipe; reproduce at most one preceding & trailing space",
      false, true, "1  |  2|10", "1 | 2 | 10"],
    ["delimiter: dot",
        false, true, ".foo.bar", ".bar.foo"],
    ["delimiter: dot (opt-out useDotAsWordSeparator)",
      false, false, ".foo.bar", ".foo.bar"],
    ["delimiter: space",
      false, true, "1 2 10", "1 2 10"],
    ["delimiter: space; treat consecutive occurrence as single occurrence",
      false, true, "1  2 10", "1 2 10"],
    ["delimiter: priority; ',\\t' --> ', '",
      false, true, "1,\t2,10", "1, 2, 10"],
    ["delimiter: priority; ',|' --> ','",
      false, true, "1,|2,10", "|2,1,10"],
    ["delimiter: priority; ', ' --> ', '",
      false, true, "1, 2,10", "1, 2, 10"],
    ["delimiter: priority; '\\t,' --> '\\t'",
      false, true, "1\t,2\t10", ",2\t1\t10"],
    ["delimiter: priority; '\\t|' --> '\\t'",
      false, true, "1\t|2\t10", "|2\t1\t10"],
    ["delimiter: priority; '\\t ' --> '\\t'",
      false, true, "1\t 2\t10", "1\t2\t10"],
    ["delimiter: priority; '|,' --> '|'",
      false, true, "1|,2|10", ",2|1|10"],
    ["delimiter: priority; '|\\t' --> '| '",
      false, true, "1|\t2|10", "1| 2| 10"],
    ["delimiter: priority; '| ' --> '| '",
      false, true, "1| 2|10", "1| 2| 10"],
    ["delimiter: priority; ' ,' --> ','",
      false, true, "1 ,2 10", "1,2 10"],
    ["delimiter: priority; ' \\t' --> ' '",
      false, true, "1 \t2 10", "1 2 10"],
    ["delimiter: priority; ' |' --> ' |'",
      false, true, "1 |2|10", "1 |2 |10"],
    ["multiline: comma before an EOL",
      false, true, "2,\n10,\n1", "1,\n2,\n10"],
    ["multiline: comma after an EOL",
      false, true, "2\n, 10,1", "1,\n2, 10"],
    ["multiline: keep indentations",
      false, true, "2,\n\t3,\n \t1", "1,\n\t2,\n \t3"],
    ["multiline: reflow: fill the spaces",
      false, true, "peach\ngrape\napple", "apple\ngrape\npeach"],
    ["multiline: reflow: first word can expand",
      false, true, "lemon\nplum\ncherry", "cherry\nlemon\nplum"],
    ["multiline: reflow: last space is free to expand",
      false, true, "watermelon\npineapple\nmango grape",
      "grape\nmango\npineapple watermelon"],
    ["multiline: nothing between first word and EOL (#2)",
      false, true, "2\n10\n1", "1\n2\n10"],
    ["options: ascending",
      false, true, "2,10,ab,Ac", "10,2,ab,Ac"],
    ["options: descending",
      true, false, "2,10,ab,Ac", "Ac,ab,2,10"],
  ];
  tt.forEach((t) => {
    const [title, descending, useDotAsWordSeparator, input, expected] = t;
    test(title, async () => {
      // Set the test input text and the selection
      const editor = vscode.window.activeTextEditor!;
      await editor.edit((editBuilder: TextEditorEdit) => {
        const document = editor.document;
        const lastLine = document.lineAt(document.lineCount - 1);
        const entireRange = new Range(new Position(0, 0), lastLine.range.end);
        editBuilder.replace(entireRange, input);
      });
      const eod = editor.document.positionAt(9999);
      editor.selections = [new Selection(0, 0, eod.line, eod.character)];

      // Call the logic
      await my.sortWords(editor, descending, useDotAsWordSeparator);

      const result = {
        text: editor.document.getText(),
        selections: editor.selections,
      };

      assert.strictEqual(result.text, expected);
    });
  });

  suite("sort selected words only", () => {
    // prettier-ignore
    const tt: Array<[string, Selection[], string, Selection[], string]> = [
      ["case 1",
        [new Selection(0, 7, 2, 9)],
        "export orange,\n  apple, pineapple,\n    grape",
        [new Selection(0, 7, 2, 13)],
        "export apple,\n  grape, orange,\n    pineapple",
      ],
      ["case 2",
        [new Selection(0, 7, 2, 9)],
        "export orange, \n  apple, pineapple, \n    grape",
        [new Selection(0, 7, 2, 13)],
        "export apple,\n  grape, orange,\n    pineapple",
      ],
    ];
    for (const t of tt) {
      const [title, selections, str, xSelections, xStr] = t;
      test(title, async () => {
        // Set the test input text and the selection
        const editor = vscode.window.activeTextEditor!;
        await editor.edit((editBuilder: TextEditorEdit) => {
          const document = editor.document;
          const lastLine = document.lineAt(document.lineCount - 1);
          const entireRange = new Range(new Position(0, 0), lastLine.range.end);
          editBuilder.replace(entireRange, str);
        });
        editor.selections = selections;

        // Call the logic
        await my.sortWords(editor, false, true);
        const result = {
          text: editor.document.getText(),
          selections: editor.selections,
        };

        assert.strictEqual(result.text, xStr);
        assert.strictEqual(
          stringifySelections(result.selections),
          stringifySelections(xSelections),
        );
      });
    }
  });
});

function stringifySelections(selections: readonly Selection[]): string {
  return (
    "[" +
    selections
      .map((s) => [
        s.anchor.line,
        s.anchor.character,
        s.active.line,
        s.active.character,
      ])
      .sort()
      .map((s) => "(" + s.join(",") + ")")
      .join(",") +
    "]"
  );
}
