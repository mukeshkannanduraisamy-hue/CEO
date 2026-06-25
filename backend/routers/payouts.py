from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import workspace_db

router = APIRouter(prefix="/payouts", tags=["Payouts"])

class PayRequest(BaseModel):
    amount_paid: float
    paid_by: str
    paid_date: str

@router.get("/")
async def get_payouts():
    query = """
    SELECT 
        id, investment_id, investor, portfolio, region, channel_partner, 
        invested, current_amount, roi_amount, payout_amount, status, 
        paid_amount, paid_date, paid_by, investment_code
    FROM zoho_payouts
    """
    try:
        rows = await workspace_db.fetch_all(query=query)
        results = [dict(row) for row in rows]
        
        # We need to compute total payout per region as well
        # but the frontend can easily do grouping if we just return the flat list,
        # or we can structure it nicely here. Given the requirements, returning flat
        # and letting frontend group it or grouping it here both work. 
        # Flat list is cleaner for API:
        return {"data": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{payout_id}/pay")
async def pay_payout(payout_id: int, payload: PayRequest):
    # Fetch existing
    query = "SELECT payout_amount, paid_amount FROM zoho_payouts WHERE id = :id"
    row = await workspace_db.fetch_one(query=query, values={"id": payout_id})
    if not row:
        raise HTTPException(status_code=404, detail="Payout not found")
        
    payout_amount = float(row["payout_amount"])
    current_paid = float(row["paid_amount"])
    
    new_paid = current_paid + payload.amount_paid
    status = "Paid" if new_paid >= payout_amount else "Partial"
    
    update_query = """
    UPDATE zoho_payouts 
    SET paid_amount = :paid_amount, status = :status, paid_by = :paid_by, paid_date = :paid_date
    WHERE id = :id
    """
    await workspace_db.execute(query=update_query, values={
        "paid_amount": new_paid,
        "status": status,
        "paid_by": payload.paid_by,
        "paid_date": payload.paid_date,
        "id": payout_id
    })
    
    return {"success": True, "new_paid_amount": new_paid, "status": status}
