import requests
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

res = requests.get('http://localhost:8000/api/zoho/mail')
data = res.json()
emails = data.get('emails', [])

att_email = next((e for e in emails if e.get('hasAttachment')), None)

if att_email:
    import requests
    from main import load_tokens, ZOHO_API_URL
    tokens = load_tokens()
    headers = {"Authorization": f"Zoho-oauthtoken {tokens['access_token']}"}
    
    # Get account id
    acc_res = requests.get(ZOHO_API_URL, headers=headers).json()
    account_id = acc_res['data'][0]['accountId']
    
    message_id = att_email['messageId']
    folder_id = att_email.get('folderId')
    
    if folder_id:
        url = f"https://mail.zoho.in/api/accounts/{account_id}/folders/{folder_id}/messages/{message_id}"
    else:
        url = f"https://mail.zoho.in/api/accounts/{account_id}/messages/{message_id}"
        
    res = requests.get(url, headers=headers)
    with open('test_raw_details.json', 'w', encoding='utf-8') as f:
        json.dump(res.json(), f, indent=2)
    print("Raw details written to test_raw_details.json")
