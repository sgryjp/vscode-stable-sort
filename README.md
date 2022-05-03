# Stable Sort

[![Version (VS Marketplace)](https://vsmarketplacebadge.apphb.com/version-short/sgryjp.vscode-stable-sort.svg)](https://marketplace.visualstudio.com/items?itemName=sgryjp.vscode-stable-sort)
![Rating (VS Marketplace)](https://vsmarketplacebadge.apphb.com/rating-star/sgryjp.vscode-stable-sort.svg)
![Installs (VS Marketplace)](https://vsmarketplacebadge.apphb.com/installs-short/sgryjp.vscode-stable-sort.svg)
&nbsp;
[![MIT license](https://img.shields.io/badge/license-MIT-lightgray.svg?longCache=true&style=popout)](https://github.com/sgryjp/vscode-stable-sort/blob/master/LICENSE.md)

Sort CSV-like words or lines in [VS Code](https://code.visualstudio.com) using stable sort algorithm.

# Feature

With single shortcut <kbd>Ctrl+Alt+R</kbd> (mac: <kbd>Cmd+Ctrl+R</kbd>),
you can:

- Sort words separated by
  - space, comma, tab, pipe (`|`)
  - separators recognized automatically
- Sort lines by
  - entire content
  - selected parts

If you want to sort in reversed (descending) order, use
<kbd>Ctrl+Alt+Shift+R</kbd> (mac: <kbd>Cmd+Ctrl+Shift+R</kbd>).

Some other key ponits:

- Words or lines will be sorted as numbers if every one of them starts with a
  token which looks like a numeric value (e.g.: `2` comes before `10`)
- Sorting algorithm is
  [stable](https://en.wikipedia.org/wiki/Sorting_algorithm#Stability)
  - The order of semantically same (depends on locale) words or lines
    will be unchanged.

## Sorting Words

If there is only one selection range and either start position, end position
or both are in the middle of a line, words inside the selection. You can select
words across lines; in that case the original indentation and line widths will
be kept.

Word separators will be recognized automatically. If one of comma (`U+0013`),
tab (`U+0009`), or pipe (`U+007C`) was found it will be used as word separator.
If not found any of them, a space (`U+0020`) will be used.

Note that spaces surrounding word separators will be normalized as below:

- Comma: Zero or one space character following after the first comma will be kept.
- Tab: Surrounding spaces are simply ignored.
- Pipe: At most one spaces preceding before and/or following after the first
  pipe character will be kept.
- Space: Word separator will always be exactly one space character.

### Example Animations

- Comma<br>
  ![Sorting words separated by comma](images/sort-words-comma.gif)
- Tab<br>
  ![Sorting words separated by tab](images/sort-words-tab.gif)
- Pipe<br>
  ![Sorting words separated by pipe](images/sort-words-pipe.gif)
- Space<br>
  ![Sorting words separated by space](images/sort-words-space.gif)

## Sorting Lines

If the condition to sort words are not met, selected lines will be sorted.

Strictly writing, lines which contains selection range(s) will be sorted using
selected part. This means that you can sort lines not only by comparing entire
content but also by comparing a portion of them. This is useful if you want to
sort on arbitrary column of visually aligned text data such as output of
[`ps` command](<https://en.wikipedia.org/wiki/Ps_(Unix)>) or CSV data.

### Example Animations

- Sort lines by entire content (CSV colorized with
  [Rainbow CSV](https://marketplace.visualstudio.com/items?itemName=mechatroner.rainbow-csv))<br>
  ![Sorting lines by entire content](images/sort-lines-whole.gif)
- Sort lines by selected parts<br>
  ![Sorting lines by selected parts](images/sort-lines-part.gif)
- Sort visually aligned lines by specific "column"<br>
  ![Sorting lines by selected parts](images/sort-visually-aligned.gif)

## Sorting Words Spread over Multiple Lines

By default you cannot sort words spread over multiple lines. If the selection
covers multiple lines, those lines touched by the selection will be sorted.
To change this behavior, set `true` to `stableSort.preferWordSorting` option.
Doing so makes this extension sort selected words if start or end of the
selection is in the middle of a line. Note that even if this option was enabled
you can sort multiple words by placing both start and end of the selection at
the beginning of a line (as in the example animation above.)

- For example, we can sort import target in Julia language:<br>
  ![Sorting words spread over multiple lines](images/sort-words-multiline.gif)<br>
  In this example, we don't need to care about where to insert a new target; just
  appending one and sorting them will move it to the right place.

# Background

Stability of sorting is not valuable in most cases except for some.

As of VS Code 1.27.2, its algorithm to sort lines are not "stable" so sorting
textually "same" words or lines may change those order. This behavior will not
be a problem in most cases because those are normally completely identical so
swapping those is not a change by all means. But, there are exceptional cases
where two textually differrent lines are evaluated as equal. In those cases,
sorted result will be different time to time.

For example, an ASCII digit character and its counter part in
[fullwidth forms](https://www.unicode.org/charts/PDF/UFF00.pdf)
are treated as equal in Japanese locale so result of sorting words like below
(BTW it's "type 2 diabetes" writen in Japanese) may change time to time:

    2型糖尿病
    ２型糖尿病

This behavior is not appreciated for tasks like compositing dictionary data,
since you cannot normalize data by simply sorting. This extension solves the
problem.

(Note that the "unstable" sort algorithm of VS Code (strictly, of Node.js) is
used for relatively large number of lines so working with small data might not
raise the problem.)
