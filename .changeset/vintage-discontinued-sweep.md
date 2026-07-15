---
"catalog": patch
---

Mark 712 out-of-production products with the `discontinued` category and add
a `defunct` manufacturer flag.

- New optional manufacturer field `defunct: true` (company gone, nothing
  still produced under the brand); set on 13 manufacturers (E-mu, Ensoniq,
  ARP, Siel, Quasimidi, Elka, Technosaurus, Gleeman, Chamberlin, EML, PPG,
  Steiner-Parker, Future Retro). Products of defunct manufacturers are
  tier-1 auto-tag candidates. The flag ships in the SQLite build as a new
  `manufacturers.defunct` column (INTEGER, default 0) so downstream apps
  can render manufacturer status.
- `discontinued:report` gains three signals: defunct-manufacturer (tier 1),
  vintagesynth.com-linked (review tier — VSE also covers current gear), and
  released-20+-years-ago (review tier — age is never auto-safe: SM58, DS-1,
  A-100 are evergreen).
- `discontinued:apply` gains `--signal defunct` and `--files <list.txt>` for
  applying human-reviewed lists.
- Tagged: 112 defunct-manufacturer products plus 600 reviewed
  vintagesynth-linked entries (55 VSE-linked products verified still in
  production or uncertain were deliberately left untagged).
