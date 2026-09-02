# Drop exports here

Illustrator SVGs go in this folder, then:

    python3 tools/import_art.py incoming/*.svg --into assets/brand/ --canvas WxH

That validates the export, moves blend modes to inline CSS, and prefixes every
id so files cannot collide. `--check` reports without writing anything.

It fails on the three export mistakes that have each cost us a day: Internal
CSS instead of Presentation Attributes, "Responsive" left checked, and an
artboard that does not match the master size.
