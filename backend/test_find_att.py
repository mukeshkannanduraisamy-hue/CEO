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

# Find email with attachment in first 50 messages
res = requests.get(f'https://mail.zoho.in/api/accounts/{account_id}/messages/view?limit=50', headers=headers).json()
emails = res.get('data', [])

att_emails = [e for e in emails if e.get('hasAttachment') == '1' or e.get('hasAttachment') == True]

if att_emails:
    print(f"Found {len(att_emails)} emails with attachments.")
    for att_email in att_emails[:3]:
        mid = att_email['messageId']
        fid = att_email.get('folderId')
        
        url = f"https://mail.zoho.in/api/accounts/{account_id}/folders/{fid}/messages/{mid}/details"
        print(f"\nTrying URL: {url}")
        r = requests.get(url, headers=headers)
        js = r.json()
        if 'data' in js:
            print(f"Subject: {js['data'].get('subject')}")
            print(f"Has Attachment: {js['data'].get('hasAttachment')}")
            if 'attachments' in js['data']:
                print(f"Attachments found in keys: {len(js['data']['attachments'])}")
                print(json.dumps(js['data']['attachments'], indent=2))
            else:
                print("No 'attachments' key in data.")
        else:
            print(f"No 'data' in response: {js}")
else:
    print("No emails with attachments found in the last 50 messages.")
