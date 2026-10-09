#!/usr/bin/env python3
"""One-time importer: turns the original GPU Bring-Up Field Manual (gpu.html) into
structured JSON under content/manual/. Kept for reproducibility; content/ is now the
source of truth, edit the JSON files directly.

Usage: python tools/extract_manual.py path/to/gpu.html
Requires: beautifulsoup4
"""
import json, pathlib, re, sys
from bs4 import BeautifulSoup

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "content" / "manual"
OUT.mkdir(parents=True, exist_ok=True)

# Privacy: the original names the person from a mentoring call. Published copy keeps the advice, not the name.
ANON = [("From the conversation with Vishakha Sadhwani, now an NVIDIA Sr. Solutions Architect (AI Inference)",
         "From a mentoring conversation with an NVIDIA Sr. Solutions Architect (AI Inference)"),
        ("Vishakha's call stressed", "the mentoring call stressed")]

def inner(el):
    h = el.decode_contents().strip() if el else ""
    for a, b in ANON:
        h = h.replace(a, b)
    return re.sub(r"\s+", " ", h)

def text(el):
    return el.get_text(" ", strip=True) if el else ""

def links(ul):
    out = []
    if not ul:
        return out
    for li in ul.find_all("li", recursive=False):
        a = li.find("a")
        note = li.find(class_="note") or li.find("span")
        out.append({"url": a["href"], "name": text(a), "note": text(note).strip() if note else ""})
    return out

def main(path):
    soup = BeautifulSoup(open(path, encoding="utf8").read(), "html.parser")
    LV = {"F": "Foundation", "P": "Practitioner", "S": "Senior"}

    # ---- overview / start here
    start = soup.find(id="start")
    leads = start.find_all("p", class_="lead", recursive=False)
    boxes = [{"title": text(b.find("h4")), "html": inner(b).split("</h4>", 1)[1].strip()} for b in start.find_all(class_="note-box")]
    header = soup.find("header") or soup
    overview = {
        "title": "GPU Bring-Up Field Manual",
        "role": "NVIDIA Solutions Architect, Infrastructure (JR2012776)",
        "intro_html": inner(soup.find(class_="lede") or soup.find("p")),
        "lead_html": inner(leads[0]) if leads else "",
        "time_html": inner(leads[1]) if len(leads) > 1 else "",
        "notes": boxes,
        "footer": text(soup.find(class_="foot")),
    }
    json.dump(overview, open(OUT / "overview.json", "w", encoding="utf8"), indent=1, ensure_ascii=False)

    # ---- domains and tasks
    domains, tasks = [], []
    for sec in soup.select("section.dom"):
        k = sec["data-dom"]
        h2 = sec.find("h2")
        name = text(h2).replace(k, "", 1).strip()
        domains.append({"key": k, "name": name})
        for art in sec.select("article.task"):
            tid = art["id"].replace("t-", "")
            tags = [text(t) for t in art.select(".tags .pill")]
            hrs = next((int(re.search(r"(\d+) h", t).group(1)) for t in tags if re.fullmatch(r"\d+ h", t)), 0)
            tier = next((t for t in tags if t.startswith("Tier")), "")
            colmain = art.select_one(".cols > div")
            steps = [inner(li) for li in colmain.find("ol").find_all("li", recursive=False)] if colmain and colmain.find("ol") else []
            deliver = colmain.find(class_="deliver") if colmain else None
            gem = colmain.find(class_="gem") if colmain else None
            repos, docs = [], []
            for blk in art.select(".refcol > div"):
                h4 = text(blk.find("h4")).lower()
                if h4.startswith("repo"):
                    repos = links(blk.find("ul"))
                elif h4.startswith("doc"):
                    docs = [{"url": d["url"], "name": d["name"]} for d in links(blk.find("ul"))]
            q = art.find(class_="q")
            tasks.append({
                "id": tid, "domain": k, "level": LV[art["data-lvl"]], "core": art.get("data-core") == "1",
                "tier": int(art.get("data-tier", 0)), "tier_label": tier, "hours": hrs,
                "title": text(art.find("h3")), "jd": text(art.find(class_="why")),
                "steps": steps,
                "deliverable_html": inner(deliver).replace("<b>Deliverable.</b>", "").strip() if deliver else "",
                "gem_html": inner(gem).replace("<b>Hidden gem.</b>", "").strip() if gem else "",
                "repos": repos, "docs": docs,
                "question": text(q).replace("Be ready for:", "").strip() if q else "",
            })
    json.dump(domains, open(OUT / "domains.json", "w", encoding="utf8"), indent=1, ensure_ascii=False)
    json.dump(tasks, open(OUT / "tasks.json", "w", encoding="utf8"), indent=1, ensure_ascii=False)

    # ---- posting coverage
    cov = soup.find(id="coverage")
    coverage = {"lead": text(cov.find(class_="lead")), "rows": []}
    for tr in cov.select("tbody tr"):
        td = tr.find_all("td")
        coverage["rows"].append({"requirement": text(td[0]), "tasks": [a.get_text(strip=True) for a in td[1].find_all("a")]})
    json.dump(coverage, open(OUT / "coverage.json", "w", encoding="utf8"), indent=1, ensure_ascii=False)

    # ---- schedule
    sch = soup.find(id="schedule")
    schedule = {"lead": text(sch.find(class_="lead")), "start_date": "2026-10-12", "weeks": []}
    for tr in sch.select("tbody tr"):
        td = tr.find_all("td")
        schedule["weeks"].append({"week": text(td[0]), "starts": text(td[1]),
                                  "tasks": [a.get_text(strip=True) for a in td[2].find_all("a")], "hours": int(text(td[3]) or 0)})
    json.dump(schedule, open(OUT / "schedule.json", "w", encoding="utf8"), indent=1, ensure_ascii=False)

    # ---- resources
    gems = soup.find(id="gems")
    gemlist = [{"url": li.a["href"], "name": text(li.a), "why": text(li.find("span")), "tasks": text(li.find("em"))} for li in gems.select(".gemlist li")]
    rd = soup.find(id="reading")
    reading = [{"url": li.a["href"], "name": text(li.a), "why": text(li.find("span"))} for li in rd.select(".readlist li")]
    extra = [{"title": text(b.find("h4")), "html": inner(b).split("</h4>", 1)[-1].strip()} for b in rd.find_all(class_="note-box")]
    iv = soup.find(id="interview")
    spines = [{"title": text(s.find("h4")), "answer": text(s.find("p"))} for s in iv.select(".spine")]
    qs = []
    for li in iv.select("ol li, ul li"):
        m = re.match(r"([A-L]\d)\s+(.*)", text(li))
        if m:
            qs.append({"task": m.group(1), "question": m.group(2)})
    ce = soup.find(id="certs")
    certs = [{"title": text(b.find("h4")), "html": inner(b).split("</h4>", 1)[-1].strip()} for b in ce.find_all(class_="note-box")]
    resources = {
        "gems": {"lead": text(gems.find(class_="lead")), "items": gemlist},
        "reading": {"lead": text(rd.find(class_="lead")), "items": reading, "extra": extra},
        "interview": {"lead": text(iv.find(class_="lead")), "spines": spines, "questions": qs},
        "certifications": certs,
    }
    json.dump(resources, open(OUT / "resources.json", "w", encoding="utf8"), indent=1, ensure_ascii=False)
    print(f"domains={len(domains)} tasks={len(tasks)} coverage={len(coverage['rows'])} weeks={len(schedule['weeks'])} "
          f"gems={len(gemlist)} reading={len(reading)} extra={len(extra)} spines={len(spines)} questions={len(qs)} certs={len(certs)}")

if __name__ == "__main__":
    main(sys.argv[1])
