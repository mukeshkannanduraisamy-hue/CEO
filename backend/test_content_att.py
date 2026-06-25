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

# Known email with attachment
mid = "1776768771683108900"
fid = "8474771000000002014"

url = f"https://mail.zoho.in/api/accounts/{account_id}/folders/{fid}/messages/{mid}/content"
print(f"Trying URL: {url}")
r = requests.get(url, headers=headers)
js = r.json()
print(f"Status: {r.status_code}")
print(f"Keys in data: {js['data'].keys() if 'data' in js else js.keys()}")
if 'data' in js and 'attachments' in js['data']:
    print(f"Found attachments in content data: {len(js['data']['attachments'])}")
    print(json.dumps(js['data']['attachments'], indent=2))
else:
    print("No attachments in content data.")
