from fastapi import APIRouter, Query
from typing import Optional
from database import workspace_db, pet_db, DB_NAME

router = APIRouter(prefix="/reports", tags=["Reports"])

def build_filters(start_date: str = None, end_date: str = None, agent_name: str = None, severity: str = None, region: str = None):
    where = "WHERE l.is_deleted = 0"
    joins = ""
    params = {}
    
    if start_date:
        where += " AND l.date_of_call >= :start_date"
        params["start_date"] = start_date
    if end_date:
        where += " AND l.date_of_call <= :end_date"
        params["end_date"] = end_date
    if agent_name:
        where += " AND l.logged_by = :agent_name"
        params["agent_name"] = agent_name
    if severity and severity != '0':
        severity_map = { '1': 'low', '2': 'neutral', '3': 'moderate', '4': 'high', '5': 'critical' }
        severity_str = severity_map.get(str(severity), str(severity))
        where += " AND n.severity = :severity"
        params["severity"] = severity_str
    if region:
        joins += f""" JOIN {DB_NAME}.investor i ON l.investor_id = i.investor_id
                      JOIN {DB_NAME}.cd_investment inv ON i.investor_id = inv.investor_id AND inv.is_deleted = 0
                      JOIN {DB_NAME}.portfolio_owner po ON inv.portfolio_owner_id = po.portfolio_owner_id """
        where += " AND po.region = :region"
        params["region"] = region
        
    return where, joins, params

@router.get("/summary")
async def get_summary_stats(
    startDate: Optional[str] = None, 
    endDate: Optional[str] = None, 
    agentName: Optional[str] = None, 
    severity: Optional[str] = None, 
    region: Optional[str] = None
):
    where, joins, params = build_filters(startDate, endDate, agentName, severity, region)
    
    query = f"""
      SELECT 
        (SELECT COUNT(*) FROM telecalling_call_log l JOIN telecalling_customer_nature n ON l.customer_nature_id = n.nature_id {joins} {where}) as totalCalls,
        (SELECT COUNT(DISTINCT logged_by) FROM telecalling_call_log l JOIN telecalling_customer_nature n ON l.customer_nature_id = n.nature_id {joins} {where}) as activeAgents,
        (SELECT COALESCE(AVG(
          CASE n.severity 
            WHEN 'low' THEN 1 
            WHEN 'neutral' THEN 2 
            WHEN 'moderate' THEN 3 
            WHEN 'high' THEN 4 
            WHEN 'critical' THEN 5 
            ELSE 0 
          END
        ), 0) FROM telecalling_call_log l 
         JOIN telecalling_customer_nature n ON l.customer_nature_id = n.nature_id 
         {joins} {where}) as avgSeverity,
        (SELECT COUNT(*) FROM telecalling_call_log l JOIN telecalling_customer_nature n ON l.customer_nature_id = n.nature_id {joins} {where} AND l.date_of_call >= CURDATE()) as callsToday
    """
    row = await workspace_db.fetch_one(query=query, values=params)
    return {"data": dict(row) if row else {}}


@router.get("/financial")
async def get_demographic_summary(
    startDate: Optional[str] = None, 
    endDate: Optional[str] = None, 
    agentName: Optional[str] = None, 
    severity: Optional[str] = None, 
    region: Optional[str] = None
):
    global_query = """
      SELECT 
        (SELECT COUNT(*) FROM investor WHERE is_deleted = 0) as totalClients,
        (SELECT COUNT(DISTINCT investor_id) FROM cd_investment WHERE is_deleted = 0 AND status = 'ACTIVE') as activeClients,
        (SELECT COUNT(*) FROM cd_investment_disbursement WHERE disbursement_status = 'COMPLETED') as totalDisbursements
    """
    global_row = await pet_db.fetch_one(query=global_query)
    
    where, joins, params = build_filters(startDate, endDate, agentName, severity, region)
    final_joins = joins
    if not region:
        final_joins += f""" JOIN {DB_NAME}.investor i ON l.investor_id = i.investor_id
                            LEFT JOIN {DB_NAME}.cd_investment inv ON i.investor_id = inv.investor_id AND inv.is_deleted = 0
                            LEFT JOIN {DB_NAME}.portfolio_owner po ON inv.portfolio_owner_id = po.portfolio_owner_id """

    regional_query = f"""
      SELECT 
        COALESCE(po.region, 'UNMAPPED') as name, 
        COUNT(*) as value
      FROM telecalling_call_log l
      JOIN telecalling_customer_nature n ON l.customer_nature_id = n.nature_id
      {final_joins}
      {where}
      GROUP BY po.region
      ORDER BY value DESC
    """
    regional_rows = await workspace_db.fetch_all(query=regional_query, values=params)
    
    return {
        "data": {
            "globalStats": dict(global_row) if global_row else {},
            "regionalData": [dict(r) for r in regional_rows]
        }
    }


@router.get("/trend")
async def get_growth_trend(
    startDate: Optional[str] = None, 
    endDate: Optional[str] = None, 
    agentName: Optional[str] = None, 
    severity: Optional[str] = None, 
    region: Optional[str] = None
):
    where, joins, params = build_filters(startDate, endDate, agentName, severity, region)
    query = f"""
      SELECT 
        DATE_FORMAT(l.date_of_call, '%Y-%m-%d') as day,
        COUNT(*) as count
      FROM telecalling_call_log l
      JOIN telecalling_customer_nature n ON l.customer_nature_id = n.nature_id
      {joins}
      {where}
      GROUP BY day
      ORDER BY day ASC
    """
    rows = await workspace_db.fetch_all(query=query, values=params)
    return {"data": [dict(r) for r in rows]}


@router.get("/distribution")
async def get_distribution(
    startDate: Optional[str] = None, 
    endDate: Optional[str] = None, 
    agentName: Optional[str] = None, 
    severity: Optional[str] = None, 
    region: Optional[str] = None
):
    where, joins, params = build_filters(startDate, endDate, agentName, severity, region)
    
    purpose_query = f"""
      SELECT c.category_name as name, COUNT(*) as value
      FROM telecalling_call_log l
      JOIN telecalling_purpose_category c ON l.purpose_category_id = c.category_id
      JOIN telecalling_customer_nature n ON l.customer_nature_id = n.nature_id
      {joins}
      {where}
      GROUP BY c.category_name
      ORDER BY value DESC
    """
    purpose_rows = await workspace_db.fetch_all(query=purpose_query, values=params)

    nature_query = f"""
      SELECT n.nature_name as name, COUNT(*) as value
      FROM telecalling_call_log l
      JOIN telecalling_customer_nature n ON l.customer_nature_id = n.nature_id
      {joins}
      {where}
      GROUP BY n.nature_name
      ORDER BY value DESC
    """
    nature_rows = await workspace_db.fetch_all(query=nature_query, values=params)
    
    return {
        "data": {
            "purposeDist": [dict(r) for r in purpose_rows],
            "natureDist": [dict(r) for r in nature_rows]
        }
    }


@router.get("/performance")
async def get_agent_performance(
    startDate: Optional[str] = None, 
    endDate: Optional[str] = None, 
    agentName: Optional[str] = None, 
    severity: Optional[str] = None, 
    region: Optional[str] = None
):
    where, joins, params = build_filters(startDate, endDate, agentName, severity, region)
    query = f"""
      SELECT 
        l.logged_by as agent,
        c.category_name as category,
        COUNT(*) as count
      FROM telecalling_call_log l
      JOIN telecalling_purpose_category c ON l.purpose_category_id = c.category_id
      JOIN telecalling_customer_nature n ON l.customer_nature_id = n.nature_id
      {joins}
      {where}
      GROUP BY l.logged_by, c.category_name
      ORDER BY count DESC
    """
    rows = await workspace_db.fetch_all(query=query, values=params)
    return {"data": [dict(r) for r in rows]}


@router.get("/heatmap")
async def get_time_heatmap(
    startDate: Optional[str] = None, 
    endDate: Optional[str] = None, 
    agentName: Optional[str] = None, 
    severity: Optional[str] = None, 
    region: Optional[str] = None
):
    where, joins, params = build_filters(startDate, endDate, agentName, severity, region)
    query = f"""
      SELECT 
        DATE(l.date_of_call) as date_val,
        HOUR(l.date_of_call) as hour,
        COUNT(*) as count
      FROM telecalling_call_log l
      JOIN telecalling_customer_nature n ON l.customer_nature_id = n.nature_id
      {joins}
      {where}
      GROUP BY date_val, hour
      ORDER BY date_val DESC, hour
    """
    rows = await workspace_db.fetch_all(query=query, values=params)
    return {"data": [dict(r) for r in rows]}


@router.get("/table")
async def get_reports_table(
    page: int = 1,
    limit: int = 10,
    search: str = '',
    startDate: Optional[str] = None, 
    endDate: Optional[str] = None, 
    agentName: Optional[str] = None, 
    severity: Optional[str] = None, 
    region: Optional[str] = None
):
    offset = (page - 1) * limit
    where, joins, params = build_filters(startDate, endDate, agentName, severity, region)
    
    table_where = where
    if search:
        table_where += " AND (i.firstname LIKE :search OR i.lastname LIKE :search OR l.logged_by LIKE :search)"
        params["search"] = f"%{search}%"
        
    query = f"""
      SELECT 
        l.log_id,
        l.date_of_call,
        l.logged_by as agent_name,
        CONCAT(i.firstname, ' ', i.lastname) as investor_name,
        c.category_name as purpose,
        n.nature_name as nature,
        n.severity,
        l.notes,
        l.custom_fields_json,
        MAX(po.region) as region
      FROM telecalling_call_log l
      JOIN telecalling_purpose_category c ON l.purpose_category_id = c.category_id
      JOIN telecalling_customer_nature n ON l.customer_nature_id = n.nature_id
      JOIN {DB_NAME}.investor i ON l.investor_id = i.investor_id
      LEFT JOIN {DB_NAME}.cd_investment inv ON i.investor_id = inv.investor_id AND inv.is_deleted = 0
      LEFT JOIN {DB_NAME}.portfolio_owner po ON inv.portfolio_owner_id = po.portfolio_owner_id
      /* region filter joins already handled in build_filters if passed, else just join */
      {table_where}
      GROUP BY l.log_id
      ORDER BY l.date_of_call DESC
      LIMIT :limit OFFSET :offset
    """
    
    # We must add limit/offset to params but databases library accepts them in dict
    table_params = params.copy()
    table_params["limit"] = limit
    table_params["offset"] = offset

    rows = await workspace_db.fetch_all(query=query, values=table_params)
    
    count_joins = ""
    if region:
        count_joins = f" JOIN {DB_NAME}.cd_investment inv ON i.investor_id = inv.investor_id AND inv.is_deleted = 0 JOIN {DB_NAME}.portfolio_owner po ON inv.portfolio_owner_id = po.portfolio_owner_id "
        
    total_query = f"""
      SELECT COUNT(DISTINCT l.log_id) as total 
      FROM telecalling_call_log l 
      JOIN telecalling_customer_nature n ON l.customer_nature_id = n.nature_id
      JOIN {DB_NAME}.investor i ON l.investor_id = i.investor_id
      {count_joins}
      {table_where}
    """
    total_row = await workspace_db.fetch_one(query=total_query, values=params)
    
    return {
        "data": {
            "data": [dict(r) for r in rows],
            "total": total_row["total"] if total_row else 0
        }
    }
