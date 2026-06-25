import asyncio
import pandas as pd
from database import workspace_db, connect_dbs, disconnect_dbs

async def main():
    await connect_dbs()
    
    # create table
    create_table = """
    CREATE TABLE IF NOT EXISTS zoho_payouts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        investment_id INT,
        investor VARCHAR(255),
        portfolio VARCHAR(255),
        region VARCHAR(255),
        channel_partner VARCHAR(255),
        invested DECIMAL(15, 2),
        current_amount DECIMAL(15, 2),
        roi_amount DECIMAL(15, 2),
        payout_amount DECIMAL(15, 2),
        status VARCHAR(50) DEFAULT 'Pending',
        paid_amount DECIMAL(15, 2) DEFAULT 0.0,
        paid_date VARCHAR(50),
        paid_by VARCHAR(255),
        investment_code VARCHAR(50)
    )
    """
    await workspace_db.execute(create_table)
    print('Table created or exists')

    # Read excel
    df = pd.read_excel(r'/home/ubuntu/yearly_investments.xlsx')
    df = df.fillna('')
    
    # Truncate
    await workspace_db.execute('TRUNCATE TABLE zoho_payouts')
    
    insert_query = """
        INSERT INTO zoho_payouts (
            investment_id, investor, portfolio, region, channel_partner, 
            invested, current_amount, roi_amount, payout_amount, investment_code
        ) VALUES (
            :investment_id, :investor, :portfolio, :region, :channel_partner,
            :invested, :current_amount, :roi_amount, :payout_amount, :investment_code
        )
    """
    
    values = []
    for _, row in df.iterrows():
        try:
            inv_id = int(row['Investment ID']) if row['Investment ID'] != '' else 0
        except ValueError:
            inv_id = 0
            
        values.append({
            'investment_id': inv_id,
            'investor': str(row['Investor']).strip() if row['Investor'] else '',
            'portfolio': str(row['Portfolio']).strip() if row['Portfolio'] else '',
            'region': str(row['Region']).strip() if row['Region'] else '',
            'channel_partner': str(row['Channel Partner']).strip() if row['Channel Partner'] else '',
            'invested': float(row['Invested (₹)']) if row['Invested (₹)'] != '' else 0.0,
            'current_amount': float(row['Current (₹)']) if row['Current (₹)'] != '' else 0.0,
            'roi_amount': float(row['ROI Amount (₹)']) if row['ROI Amount (₹)'] != '' else 0.0,
            'payout_amount': float(row['2% Payout']) if row['2% Payout'] != '' else 0.0,
            'investment_code': str(row['Investment Code']).strip() if row['Investment Code'] else ''
        })
    
    await workspace_db.execute_many(insert_query, values)
    print(f'Inserted {len(values)} rows into zoho_payouts')
    
    await disconnect_dbs()

asyncio.run(main())
