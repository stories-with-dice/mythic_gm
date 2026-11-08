# Notice: license and attribution

Mythic Toolkit is an **unofficial fan tool**. Word Mill Games did not make it
and does not endorse it. It is free, and it is not for sale.

## License

Copyright © stories with dice.

This project is licensed under the Creative Commons
Attribution-NonCommercial 4.0 International license (CC BY-NC 4.0). See
[LICENSE](LICENSE) or <https://creativecommons.org/licenses/by-nc/4.0/>.

The files in `js/vendor/` and `css/vendor-easymde.css` are not covered by
that license. They keep their own licenses (see "Vendor libraries" below).
The adapted Triple-O material is under CC BY-SA 4.0 (see "Triple-O" below).

## Mythic content (Word Mill Games)

This work is based on these products by Tana Pigeon, published by
[Word Mill Games](https://www.wordmillgames.com/):

- *Mythic Game Master Emulator Second Edition*
- *One-Page Mythic Game Master Emulator*
- *The Adventure Crafter*
- *The Location Crafter*
- *The Creature Crafter*
- *Mythic Magazine* (the one-page tools, Volume 42 "3-Act Structure",
  Volume 50 "Deconstruct The Known", and Volume 71 "Node Based Narratives")

Word Mill Games licenses the text of these products under
[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). See
<https://wordmillgames.com/license.html>.

Changes: the tables are transcribed into code, and the rules are summarized,
adapted, and automated as dice rolls. Where a rule is ambiguous, the app makes
a choice and writes it to the Campaign Log. This app has no Word Mill Games
art, logos, or trade dress. You need the books to play.

## Cloud Empress: Solo Protocol

The Player Emulator tab adapts tables from *Cloud Empress: Solo Protocol*.
*Cloud Empress* — <https://cloudempress.com/>. These tables are not covered
by Word Mill Games' license, and by this project's CC BY-NC 4.0 license only
as far as their authors allow.

## Triple-O (Cezar Capacle)

The Triple-O tab adapts *Triple-O: The Player Character Emulator*, version
1.0.2, by Cezar Capacle, published by Critical Kit Ltd (2026),
<https://capacle.itch.io/triple-o-zine>. The text of Triple-O is licensed
under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

Changes: the 14 d66 tables are transcribed into `js/app/01b-triple-o-tables.js`,
and the rules are summarized and automated as dice rolls in
`js/app/17c-tab-triple-o.js` (the Triple-O Check, Double-Down, Group Action
ranking and the Trait Sheet). A tie in the Group Action ranking is not
covered by the rules: the app rolls the three dice again and writes this to
the Campaign Log. Because of the ShareAlike term, this adapted Triple-O
material (the tables, and the rule summaries and flowchart text) is shared
under CC BY-SA 4.0, not under this project's CC BY-NC 4.0 license. The app
has no Triple-O art, logos, or trade dress.

## Vendor libraries

| Library | License |
|---|---|
| [marked](https://github.com/markedjs/marked) | MIT |
| [DOMPurify](https://github.com/cure53/DOMPurify) | Apache-2.0 / MPL-2.0 |
| [EasyMDE](https://github.com/Ionaru/easy-markdown-editor) (bundles CodeMirror 5) | MIT |

Each vendor file keeps its original license header.
