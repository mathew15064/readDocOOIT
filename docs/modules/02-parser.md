# Module: Parser
## Purpose
Extract version, date, and doc_type from filenames.
## Public API
`parseFilename(fileName)`
## Dependencies
None (pure function)
## Edge Cases
Multiple version strings in one filename (take LAST match), missing version, Japanese characters.
## Tests
10+ cases with Japanese names, edge cases for regex `/_V(\d+)_(\d{8})/`.
