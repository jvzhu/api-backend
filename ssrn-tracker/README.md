# SSRN Stats Tracker

Automatically scrapes the public SSRN author page for [Vivien Jiaqian Zhu (Author ID 5249645)](https://papers.ssrn.com/sol3/cf_dev/AbsByAuth.cfm?per_id=5249645) and appends a timestamped snapshot of paper download stats to [`ssrn_stats_history.csv`](ssrn_stats_history.csv).

## How it works

The script (`ssrn_stats_tracker.py`) fetches the public SSRN author page, parses each listed paper's abstract ID, title, and download count, and appends a row per paper to `ssrn_stats_history.csv` with the current date. Each run produces a new dated snapshot so you can track trends over time.

## Automated weekly runs

A GitHub Actions workflow (`.github/workflows/ssrn-tracker.yml`) runs every **Monday at 08:00 UTC** and commits the updated CSV automatically. You can also trigger it manually via the **workflow_dispatch** event from the Actions tab.

## Local usage

```bash
pip install requests beautifulsoup4
python ssrn_stats_tracker.py
```

The CSV file will be created (or appended to) in the same directory as the script.

## Caveats

- **No public stats API:** SSRN does not offer a public API for paper statistics, so this tool scrapes the HTML author page. If SSRN changes its page markup, the CSS selectors in `fetch_papers()` may need updating.
- **Downloads only:** Only download counts are publicly visible on the author page. View counts require a logged-in session and are not captured by this script.
- **Respectful cadence:** The weekly schedule is intentional — running more frequently would place unnecessary load on SSRN's servers.
