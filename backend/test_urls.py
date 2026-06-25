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

# Find email with attachment
res = requests.get(f'https://mail.zoho.in/api/accounts/{account_id}/messages/view?limit=20', headers=headers).json()
emails = res.get('data', [])
att_email = next((e for e in emails if e.get('hasAttachment')), None)

if att_email:
    mid = att_email['messageId']
    fid = att_email.get('folderId')
    
    urls = [
        f"https://mail.zoho.in/api/accounts/{account_id}/messages/{mid}",
        f"https://mail.zoho.in/api/accounts/{account_id}/folders/{fid}/messages/{mid}" if fid else None,
        f"https://mail.zoho.in/api/accounts/{account_id}/messages/{mid}?attachments=true"
    ]
    
    for url in urls:
        if not url: continue
        print(f"\nTrying URL: {url}")
        r = requests.get(url, headers=headers)
        print(f"Status: {r.status_code}")
        try:
            js = r.json()
            if 'data' in js:
                data = js['data']
                print(f"Keys in data: {data.keys()}")
                if 'attachments' in data:
                    print(f"Found attachments: {len(data['attachments'])}")
                    print(json.dumps(data['attachments'], indent=2))
        except:
            print("Failed to parse JSON")
else:
    print("No emails with attachments found.")
