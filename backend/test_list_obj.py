import requests
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

from main import load_tokens, ZOHO_API_URL

tokens = load_tokens()
headers = {"Authorization": f"Zoho-oauthtoken {tokens['access_token']}"}

# Get account id
acc_res = requests.get(ZOHO_API_URL, headers=headers).json()
account_id = acc_res['data'][0]['accountId']

# Get messages
res = requests.get(f'https://mail.zoho.in/api/accounts/{account_id}/messages/view?limit=50', headers=headers).json()
emails = res.get('data', [])

att_email = next((e for e in emails if e.get('hasAttachment') == '1'), None)

if att_email:
    print("Full email object from list view:")
    print(json.dumps(att_email, indent=2))
else:
    print("No email with attachment found.")
