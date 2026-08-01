"""Track SSRN paper views/downloads over time for an author.

Usage: python ssrn_stats_tracker.py
Scheduled weekly via .github/workflows/ssrn-tracker.yml
"""
import csv
import datetime
import pathlib
import re

import requests
from bs4 import BeautifulSoup

AUTHOR_ID = "5249645"  # Vivien Jiaqian Zhu
AUTHOR_URL = f"https://papers.ssrn.com/sol3/cf_dev/AbsByAuth.cfm?per_id={AUTHOR_ID}"
OUT_FILE = pathlib.Path(__file__).parent / "ssrn_stats_history.csv"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; ssrn-stats-tracker/1.0)"}


def fetch_papers():
    resp = requests.get(AUTHOR_URL, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    papers = []
    # SSRN author pages list papers with abstract links and download stats;
    # adjust selectors if SSRN changes its markup.
    for row in soup.select("div.papers-list li, tr"):
        link = row.select_one("a[href*='abstract_id=']")
        if not link:
            continue
        m = re.search(r"abstract_id=(\d+)", link["href"])
        if not m:
            continue
        abstract_id = m.group(1)
        title = link.get_text(strip=True)
        downloads_el = row.select_one(".downloads, span.note")
        downloads = ""
        if downloads_el:
            dm = re.search(r"([\d,]+)", downloads_el.get_text())
            downloads = dm.group(1).replace(",", "") if dm else ""
        papers.append({"abstract_id": abstract_id, "title": title, "downloads": downloads})
    return papers


def append_snapshot(papers):
    today = datetime.date.today().isoformat()
    new_file = not OUT_FILE.exists()
    with OUT_FILE.open("a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["date", "abstract_id", "title", "downloads"])
        if new_file:
            writer.writeheader()
        for p in papers:
            writer.writerow({"date": today, **p})


if __name__ == "__main__":
    papers = fetch_papers()
    append_snapshot(papers)
    print(f"Recorded {len(papers)} papers on {datetime.date.today()}")
