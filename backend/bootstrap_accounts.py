import json, os, uuid, requests
from datetime import datetime

TOKEN_FILE = 'zoho_tokens.json'
ACCOUNTS_FILE = 'connected_accounts.json'

if os.path.exists(ACCOUNTS_FILE):
    with open(ACCOUNTS_FILE) as f:
        data = json.load(f)
    accs = data.get('accounts', [])
    print(f'connected_accounts.json exists - {len(accs)} account(s):')
    for a in accs:
        print(f"  email={a.get('email','?')} default={a.get('isDefault')} id={a['id'][:8]}")
elif os.path.exists(TOKEN_FILE):
    with open(TOKEN_FILE) as f:
        tokens = json.load(f)
    email, name, zoho_id = '', 'Default Account', ''
    try:
        headers = {'Authorization': f"Zoho-oauthtoken {tokens['access_token']}"}
        resp = requests.get('https://mail.zoho.in/api/accounts', headers=headers, timeout=10).json()
        acc = resp['data'][0]
        email = acc.get('primaryEmailAddress', '')
        name = acc.get('displayName', email)
        zoho_id = acc.get('accountId', '')
        print(f'Got account info: {email}')
    except Exception as ex:
        print(f'Could not fetch account info: {ex}')
    data = {'accounts': [{'id': str(uuid.uuid4()), 'email': email, 'displayName': name,
                          'accountId': zoho_id, 'tokens': tokens, 'isDefault': True,
                          'connectedAt': datetime.utcnow().isoformat()}]}
    with open(ACCOUNTS_FILE, 'w') as f:
        json.dump(data, f, indent=2)
    print(f'Created connected_accounts.json with account: {email}')
else:
    print('No token file found - please authenticate first')
