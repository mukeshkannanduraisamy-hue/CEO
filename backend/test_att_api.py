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

# Get recent emails to find one with attachment
res = requests.get(f'https://mail.zoho.in/api/accounts/{account_id}/messages/view?limit=20', headers=headers).json()
emails = res.get('data', [])

att_email = next((e for e in emails if e.get('hasAttachment')), None)

if att_email:
    message_id = att_email['messageId']
    folder_id = att_email.get('folderId')
    
    print(f"Found email with attachment: {message_id} in folder {folder_id}")
    
    if folder_id:
        url = f"https://mail.zoho.in/api/accounts/{account_id}/folders/{folder_id}/messages/{message_id}/attachments"
    else:
        url = f"https://mail.zoho.in/api/accounts/{account_id}/messages/{message_id}/attachments"
        
    res = requests.get(url, headers=headers)
    print(f"Status: {res.status_code}")
    with open('test_attachment_api.json', 'w', encoding='utf-8') as f:
        json.dump(res.json(), f, indent=2)
    print("Attachment info written to test_attachment_api.json")
else:
    print("No emails with attachments found.")
