import requests
import json
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

def load_tokens():
    with open('zoho_tokens.json', 'r') as f:
        return json.load(f)

tokens = load_tokens()
headers = {"Authorization": f"Zoho-oauthtoken {tokens['access_token']}"}
ZOHO_API_URL = "https://mail.zoho.in/api/accounts"

# Get account id
acc_res = requests.get(ZOHO_API_URL, headers=headers).json()
if 'data' not in acc_res:
    print("Error fetching account:", acc_res)
    sys.exit(1)
account_id = acc_res['data'][0]['accountId']

# Find any email
res = requests.get(f'https://mail.zoho.in/api/accounts/{account_id}/messages/view?limit=10', headers=headers).json()
emails = res.get('data', [])

if emails:
    email = emails[0]
    mid = email['messageId']
    fid = email.get('folderId')
    
    # If fid is missing, get it from details
    if not fid:
        print(f"Folder ID missing for {mid}, fetching details first...")
        det_res = requests.get(f"https://mail.zoho.in/api/accounts/{account_id}/messages/{mid}/details", headers=headers).json()
        fid = det_res.get('data', {}).get('folderId')
    
    if fid:
        url = f"https://mail.zoho.in/api/accounts/{account_id}/folders/{fid}/messages/{mid}/attachmentinfo"
        print(f"Fetching attachments from: {url}")
        r = requests.get(url, headers=headers)
        print(f"Status: {r.status_code}")
        print(json.dumps(r.json(), indent=2))
    else:
        print("Could not resolve Folder ID.")
else:
    print("No emails found.")
