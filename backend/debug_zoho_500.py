import requests
import json
import os

ACCOUNTS_FILE = "connected_accounts.json"

def test_send():
    if not os.path.exists(ACCOUNTS_FILE):
        print("Accounts file not found")
        return
        
    with open(ACCOUNTS_FILE, 'r') as f:
        data = json.load(f)
    
    acc = data['accounts'][0]
    token = acc['tokens']['access_token']
    zid = acc['accountId']
    email = acc['email'] # Fixed key
    
    url = f"https://mail.zoho.in/api/accounts/{zid}/messages"
    headers = {
        "Authorization": f"Zoho-oauthtoken {token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "fromAddress": email,
        "toAddress": "gunaece94@gmail.com",
        "subject": "System Test",
        "content": "This is a test message to diagnose the 500 error.",
        "mailFormat": "html"
    }
    
    print(f"Sending to {url}...")
    resp = requests.post(url, headers=headers, json=payload)
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.text}")

if __name__ == "__main__":
    test_send()
