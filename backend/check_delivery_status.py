import requests
import json
from datetime import datetime

# ZeptoMail Configuration from main.py
API_KEY = "PHtE6r0EFu3oiW8v+xQB4aS5FpWtYIp7/b4yLlIWt4xGA6QLTE0D/919wWDkq014A/JDR6GfzI1q5bOVsO2FIm7rNmcaVWqyqK3sx/VYSPOZsbq6x00VtF4cdk3VUI7net5v1yzRstvaNA=="
BASE_URL = "https://api.zeptomail.in/v1.1/email"

headers = {
    "Authorization": f"Zoho-encr-apikey {API_KEY}",
    "Content-Type": "application/json"
}

def get_logs(limit=100, offset=0):
    url = f"{BASE_URL}?limit={limit}&offset={offset}"
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        return response.json()
    else:
        print(f"Error fetching logs: {response.status_code} - {response.text}")
        return None

def check_delivery():
    all_logs = []
    limit = 100
    offset = 0
    
    # Fetch up to 500 logs to be safe
    for i in range(5):
        data = get_logs(limit=limit, offset=offset)
        if not data or "data" not in data or "logs" not in data["data"]:
            break
        logs = data["data"]["logs"]
        if not logs:
            break
        all_logs.extend(logs)
        offset += limit
        if len(logs) < limit:
            break
            
    print(f"Total logs fetched: {len(all_logs)}")
    
    status_counts = {}
    for log in all_logs:
        status = log.get("email_info", {}).get("status", "unknown")
        status_counts[status] = status_counts.get(status, 0) + 1
        
    print("\nDelivery Status Summary:")
    for status, count in status_counts.items():
        print(f"{status}: {count}")
        
    # Check if we can identify the ones with CSV attachments
    # We might not be able to see attachments in logs directly, 
    # but we can see the total success/failure.
    
if __name__ == "__main__":
    check_delivery()
