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

url = f"https://mail.zoho.in/api/accounts/{account_id}/folders/{fid}/messages/{mid}/attachments"
print(f"Trying URL: {url}")
r = requests.get(url, headers=headers)
print(f"Status: {r.status_code}")
print(json.dumps(r.json(), indent=2))
