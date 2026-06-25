import json
from fastapi import APIRouter
from database import workspace_db

router = APIRouter(prefix="/zoho_reports", tags=["Zoho Reports"])

@router.get("/verification-summary")
async def get_verification_summary(
    region: str = None,
    portfolio: str = None,
):
    query = "SELECT cells_json FROM zoho_investments"
    try:
        rows = await workspace_db.fetch_all(query=query)
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Database fetch failed: {e}")
    
    
    status_map = {
        "cash to be verified": "Cash to be Verified",
        "fullly verified": "Fully Verified",  # typo in sheet
        "fully verified": "Fully Verified",
        "lockin convert": "Lockin Convert",
        "lokin convert": "Lockin Convert",   # typo in sheet
        "not verified": "Not Verified",
        "partial verified": "Partial Verified",
    }
    target_statuses = list(dict.fromkeys(status_map.values()))
    
    marketers_data = {}
    regions_set = set()
    portfolios_set = set()
    
    for row in rows:
        try:
            data = json.loads(row["cells_json"])
            marketer = data[17] if data[17] else "(Blank)"
            status = data[10] if data[10] else "(Blank)"
            r = str(data[3]) if len(data) > 3 and data[3] is not None else ""
            p = str(data[16]) if len(data) > 16 and data[16] is not None else ""
            
            if r: regions_set.add(r)
            if p: portfolios_set.add(p)
            
            if region and region != "All" and r != region:
                continue
            if portfolio and portfolio != "All" and p != portfolio:
                continue
            
            # Normalize the raw status string
            norm_status = status_map.get(str(status).strip().lower())
            if not norm_status:
                continue
            status = norm_status

            if marketer not in marketers_data:
                marketers_data[marketer] = {s: 0 for s in target_statuses}
                marketers_data[marketer]["Total"] = 0
                
            marketers_data[marketer][status] += 1
            marketers_data[marketer]["Total"] += 1
        except Exception:
            continue
            
    # Convert to list and sort
    results = []
    for m, counts in marketers_data.items():
        results.append({
            "marketer": m,
            **counts
        })
        
    results.sort(key=lambda x: x["marketer"])
    
    # Calculate column totals
    totals = {s: sum(r[s] for r in results) for s in target_statuses}
    totals["Total"] = sum(r["Total"] for r in results)
    
    return {
        "statuses": target_statuses,
        "data": results,
        "totals": totals,
        "available_regions": sorted(list(regions_set)),
        "available_portfolios": sorted(list(portfolios_set))
    }

@router.get("/verification-flow")
async def get_verification_flow():
    """
    Groups investments by Marketer.
    For each marketer shows: total investments, principal, status breakdown, health %.
    Status breakdown uses the same normalization as verification-summary.
    """
    query = "SELECT cells_json FROM zoho_investments"
    try:
        rows = await workspace_db.fetch_all(query=query)
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Database fetch failed: {e}")

    status_map = {
        "cash to be verified": "Cash to be Verified",
        "fullly verified":     "Fully Verified",
        "fully verified":      "Fully Verified",
        "lockin convert":      "Lockin Convert",
        "lokin convert":       "Lockin Convert",
        "not verified":        "Not Verified",
        "partial verified":    "Partial Verified",
    }
    target_statuses = list(dict.fromkeys(status_map.values()))

    # Global counters
    total_investments = 0
    total_principal   = 0.0
    regions_set       = set()
    portfolios_set    = set()

    # marketer → { name, total, principal, statuses…, region_set, portfolio_set }
    marketers_data = {}

    for row in rows:
        try:
            data = json.loads(row["cells_json"])

            principal = 0.0
            try:
                principal = float(str(data[2]).replace(",", ""))
            except Exception:
                pass

            raw_status = str(data[10]).strip() if data[10] else ""
            norm_status = status_map.get(raw_status.lower())
            if not norm_status:
                continue  # skip rows with unknown status

            marketer  = str(data[17]).strip() if data[17] else "(Blank)"
            region    = str(data[3]).strip()  if len(data) > 3  and data[3]  else ""
            portfolio = str(data[16]).strip() if len(data) > 16 and data[16] else ""

            total_investments += 1
            total_principal   += principal
            if region:    regions_set.add(region)
            if portfolio: portfolios_set.add(portfolio)

            if marketer not in marketers_data:
                marketers_data[marketer] = {
                    "name":      marketer,
                    "total":     0,
                    "principal": 0.0,
                    "regions":   set(),
                    "portfolios": set(),
                }
                for s in target_statuses:
                    marketers_data[marketer][s] = 0

            md = marketers_data[marketer]
            md["total"]     += 1
            md["principal"] += principal
            md[norm_status] += 1
            if region:    md["regions"].add(region)
            if portfolio: md["portfolios"].add(portfolio)

        except Exception:
            continue

    # Build final list
    fully_verified_key = "Fully Verified"
    marketers_list = []
    for md in marketers_data.values():
        fv    = md.get(fully_verified_key, 0)
        total = md["total"]
        health = round((fv / total) * 100) if total > 0 else 0

        marketers_list.append({
            "name":       md["name"],
            "total":      total,
            "principal":  round(md["principal"]),
            "health":     health,
            "regions":    sorted(list(md["regions"])),
            "portfolios": sorted(list(md["portfolios"])),
            **{s: md.get(s, 0) for s in target_statuses},
        })

    # Sort by total descending
    marketers_list.sort(key=lambda x: x["total"], reverse=True)

    # Grand totals per status
    status_totals = {s: sum(m[s] for m in marketers_list) for s in target_statuses}

    return {
        "global": {
            "total_investments": total_investments,
            "total_principal":   round(total_principal),
            "total_marketers":   len(marketers_list),
            "available_regions": sorted(list(regions_set)),
            "available_portfolios": sorted(list(portfolios_set)),
        },
        "statuses":      target_statuses,
        "status_totals": status_totals,
        "marketers":     marketers_list,
    }
