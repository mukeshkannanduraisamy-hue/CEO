import requests
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

res = requests.get('http://localhost:8000/api/zoho/mail')
data = res.json()
emails = data.get('emails', [])

att_email = next((e for e in emails if e.get('hasAttachment')), None)

if att_email:
    folder_param = f"?folder_id={att_email['folderId']}" if 'folderId' in att_email else ""
    detail_res = requests.get(f'http://localhost:8000/api/zoho/mail/{att_email["messageId"]}{folder_param}')
    with open('test_output.json', 'w', encoding='utf-8') as f:
        json.dump(detail_res.json(), f, indent=2)
    print("Output written to test_output.json")
else:
    print("No emails with attachments found.")
