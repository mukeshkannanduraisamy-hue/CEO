import main, re
data, _ = main.zoho_api_request('GET', main.ZOHO_API_URL)
acc_id = data['data'][0]['accountId']
msg, _ = main.zoho_api_request('GET', f'https://mail.zoho.in/api/accounts/{acc_id}/messages/view?limit=1')
m_id = msg['data'][0]['messageId']
f_id = msg['data'][0]['folderId']
content_url = f'https://mail.zoho.in/api/accounts/{acc_id}/folders/{f_id}/messages/{m_id}/content'
c_data, _ = main.zoho_api_request('GET', content_url)
html = c_data.get('data',{}).get('content', '')
print('Images src:', re.findall(r'<img[^>]+src=[\"\']([^\"]+)[\"\']', html))
