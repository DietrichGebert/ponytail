# Synthetic AISP package

Discover skills through `aisp_list.json`, or read `*_aisp/aisp.aisop.json` directly if
the index is stale. The index and per-skill README are generated projections of the
program. No discovery script is shipped in this benchmark fixture.

The workflow's `run_report` node invokes `python report.py 2 5 7` from the
`aisp/report_cleanup_aisp/` directory in a prepared Python 3 environment. New skills
are added by creating another `<id>_aisp/aisp.aisop.json` package and regenerating
the index outside the agent workspace. This fixture opts out of the optional
`SKILL.md` bridge because it tests the native package only.
