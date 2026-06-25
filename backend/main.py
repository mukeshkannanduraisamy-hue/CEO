import os
import json
import requests
import asyncio
import io
import random
import pandas as pd
from fastapi import FastAPI, HTTPException, File, UploadFile, Form, BackgroundTasks
from fastapi.responses import RedirectResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from dotenv import load_dotenv
from routers import reports, zoho_reports, payouts
from database import connect_dbs, disconnect_dbs

load_dotenv()

app = FastAPI(title="CEO Command Center API")

@app.on_event("startup")
async def startup():
    await connect_dbs()

@app.on_event("shutdown")
async def shutdown():
    await disconnect_dbs()

# Register Routers
app.include_router(reports.router, prefix="/api")
app.include_router(zoho_reports.router, prefix="/api")
app.include_router(payouts.router, prefix="/api")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ZOHO_CLIENT_ID = os.getenv("ZOHO_CLIENT_ID")
ZOHO_CLIENT_SECRET = os.getenv("ZOHO_CLIENT_SECRET")
ZOHO_REDIRECT_URI = os.getenv("ZOHO_REDIRECT_URI")
ZOHO_ACCOUNTS_URL = "https://accounts.zoho.in"
ZOHO_MAIL_API = "https://mail.zoho.in/api"
ZOHO_API_URL = f"{ZOHO_MAIL_API}/accounts"
# TOKEN_FILE and ACCOUNTS_FILE are defined below after DATA_DIR is set

import uuid
from datetime import datetime

# On Vercel, only /tmp is writable. Locally, use current directory.
DATA_DIR = "/tmp" if os.getenv("VERCEL") else os.getcwd()

CAMPAIGNS_LOG_FILE = os.path.join(DATA_DIR, "campaigns_log.json")
ACCOUNTS_FILE = os.path.join(DATA_DIR, "connected_accounts.json")
TOKEN_FILE = os.path.join(DATA_DIR, "zoho_tokens.json")
EMAILS_DISABLED = False # KILL SWITCH - Set to False to enable emails

def load_campaigns():
    if os.path.exists(CAMPAIGNS_LOG_FILE):
        try:
            with open(CAMPAIGNS_LOG_FILE, 'r') as f:
                data = json.load(f)
            # Strip internal fields that can't be serialized
            for c in data.values():
                c.pop('rows', None)
            return data
        except Exception:
            pass
    return {}

def save_campaigns(campaigns: dict):
    try:
        serializable = {}
        for cid, c in campaigns.items():
            serializable[cid] = {k: v for k, v in c.items() if k != 'rows'}
        with open(CAMPAIGNS_LOG_FILE, 'w') as f:
            json.dump(serializable, f, indent=2, default=str)
    except Exception as e:
        print(f'[Campaigns] Save error: {e}')

# ─── Multi-Account Storage ───────────────────────────────────────────────────

def load_all_accounts():
    if os.path.exists(ACCOUNTS_FILE):
        with open(ACCOUNTS_FILE, 'r') as f:
            return json.load(f)
    # Migrate legacy single token
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, 'r') as f:
            tokens = json.load(f)
        return {"accounts": [{"id": str(uuid.uuid4()), "email": "", "displayName": "Default Account",
                              "accountId": "", "tokens": tokens, "isDefault": True, "connectedAt": ""}]}
    return {"accounts": []}

def save_all_accounts(data):
    with open(ACCOUNTS_FILE, 'w') as f:
        json.dump(data, f, indent=2)

def get_account_tokens(account_id: str = None):
    data = load_all_accounts()
    accounts = data.get("accounts", [])
    if not accounts:
        return None
    if account_id:
        acc = next((a for a in accounts if a["id"] == account_id), None)
    else:
        acc = next((a for a in accounts if a.get("isDefault")), accounts[0])
    return acc["tokens"] if acc else None

def get_default_account_id():
    data = load_all_accounts()
    accounts = data.get("accounts", [])
    if not accounts: return None
    acc = next((a for a in accounts if a.get("isDefault")), accounts[0])
    return acc["id"]

# ─── Token Management ────────────────────────────────────────────────────────

def save_tokens(tokens):
    with open(TOKEN_FILE, 'w') as f:
        json.dump(tokens, f)

def load_tokens(account_id: str = None):
    return get_account_tokens(account_id)

def refresh_zoho_token(account_id: str = None):
    print(f"Refreshing token for account {account_id}...")
    all_data = load_all_accounts()
    accounts = all_data.get("accounts", [])
    if not accounts: return None
    
    if account_id:
        acc = next((a for a in accounts if a["id"] == account_id), None)
    else:
        acc = next((a for a in accounts if a.get("isDefault")), accounts[0])
        
    if not acc: return None
    
    tokens = acc.get("tokens")
    if not tokens or "refresh_token" not in tokens:
        return None
        
    cid = acc.get("client_id", ZOHO_CLIENT_ID)
    csecret = acc.get("client_secret", ZOHO_CLIENT_SECRET)

    resp = requests.post(f"{ZOHO_ACCOUNTS_URL}/oauth/v2/token", data={
        "grant_type": "refresh_token",
        "client_id": cid,
        "client_secret": csecret,
        "refresh_token": tokens["refresh_token"]
    })
    data = resp.json()
    if "access_token" in data:
        tokens.update(data)
        # Update tokens in accounts file
        acc["tokens"] = tokens
        save_all_accounts(all_data)
        save_tokens(tokens)  # Legacy
        return tokens["access_token"]
    print(f"Refresh failed: {data}")
    return None

def zoho_api_request(method: str, url: str, json_payload=None, account_id: str = None):
    """Make authenticated Zoho API request with auto token refresh."""
    tokens = get_account_tokens(account_id)
    if not tokens or "access_token" not in tokens:
        return None, 401

    def _call(token):
        headers = {
            "Authorization": f"Zoho-oauthtoken {token}",
            "Content-Type": "application/json"
        }
        m = method.upper()
        if m == "GET":    return requests.get(url, headers=headers)
        if m == "POST":   return requests.post(url, headers=headers, json=json_payload)
        if m == "PUT":    return requests.put(url, headers=headers, json=json_payload)
        if m == "PATCH":  return requests.patch(url, headers=headers, json=json_payload)
        if m == "DELETE": return requests.delete(url, headers=headers)
        return None

    resp = _call(tokens["access_token"])
    if resp is not None and resp.status_code == 401:
        new_token = refresh_zoho_token(account_id)
        if new_token:
            resp = _call(new_token)

    if resp is None:
        return None, 500
    print(f"[Zoho] {method} {url} -> {resp.status_code}")
    try:
        return resp.json(), resp.status_code
    except Exception:
        return resp.text, resp.status_code

def zoho_upload_attachment(account_id_zoho: str, filename: str, file_content: bytes, account_id: str = None):
    """Multipart upload of attachment."""
    tokens = get_account_tokens(account_id)
    if not tokens:
        return None, 401
    url = f"{ZOHO_MAIL_API}/accounts/{account_id_zoho}/messages/attachments"

    def _call(token):
        return requests.post(url,
            headers={"Authorization": f"Zoho-oauthtoken {token}"},
            files={"file": (filename, file_content)}
        )

    resp = _call(tokens["access_token"])
    if resp.status_code == 401:
        new_token = refresh_zoho_token(account_id)
        if new_token:
            resp = _call(new_token)
    try:
        return resp.json(), resp.status_code
    except Exception:
        return resp.text, resp.status_code

def get_account_info(account_id: str = None):
    """Return (zoho_account_id, account_dict) or raise 502."""
    data, status = zoho_api_request("GET", ZOHO_API_URL, account_id=account_id)
    if status != 200 or not data or not data.get("data"):
        raise HTTPException(status_code=502, detail="Cannot reach Zoho Mail account")
    return data["data"][0]["accountId"], data["data"][0]

def resolve_folder_id(account_id: str, message_id: str, folder_id: str = None) -> str:
    """If folder_id missing, fetch it from message details."""
    if folder_id and folder_id != "undefined":
        return folder_id
    det, _ = zoho_api_request("GET", f"{ZOHO_MAIL_API}/accounts/{account_id}/messages/{message_id}/details")
    if det and "data" in det:
        return det["data"].get("folderId")
    return None

# ─── Pydantic Models ─────────────────────────────────────────────────────────

class SendEmailRequest(BaseModel):
    toAddress: str
    ccAddress: str = ""
    bccAddress: str = ""
    subject: str
    content: str
    attachments: Optional[List[dict]] = None

class ReplyEmailRequest(BaseModel):
    messageId: str
    toAddress: str
    ccAddress: str = ""
    subject: str
    content: str
    isForward: bool = False
    attachments: Optional[List[dict]] = None

class UpdateMessageRequest(BaseModel):
    messageIds: List[str]
    mode: str  # markAsRead | markAsUnRead | flagMessage | unflagMessage | moveMessage | markAsSpam | markAsNotSpam
    folderId: Optional[str] = None

class LabelRequest(BaseModel):
    tagId: str

class CreateFolderRequest(BaseModel):
    folderName: str
    parentId: Optional[str] = None

class DraftRequest(BaseModel):
    toAddress: str = ""
    subject: str = ""
    content: str = ""

# ─── Auth ────────────────────────────────────────────────────────────────────

AUTH_STATES = {}

@app.get("/")
def read_root(code: str = None, state: str = None, error: str = None):
    if code or error:
        return zoho_auth_callback(code, state=state, error=error)
    return {"status": "CEO Command Center API running"}

@app.get("/api/auth/zoho")
def zoho_auth_redirect(mode: str = "connect", client_id: str = None, client_secret: str = None):
    state_id = str(uuid.uuid4())
    AUTH_STATES[state_id] = {
        "mode": mode,
        "client_id": client_id or ZOHO_CLIENT_ID,
        "client_secret": client_secret or ZOHO_CLIENT_SECRET
    }
    
    scope = "ZohoMail.accounts.ALL,ZohoMail.messages.ALL,ZohoMail.folders.ALL,ZohoMail.tags.ALL,ZohoCliq.Messages.ALL"
    url = (f"{ZOHO_ACCOUNTS_URL}/oauth/v2/auth?response_type=code"
           f"&client_id={AUTH_STATES[state_id]['client_id']}&scope={scope}"
           f"&redirect_uri={ZOHO_REDIRECT_URI}&access_type=offline&prompt=consent&state={state_id}")
    return RedirectResponse(url)

@app.get("/api/auth/zoho/callback")
def zoho_auth_callback(code: str, state: str = None, error: str = None):
    if error:
        raise HTTPException(400, f"Zoho error: {error}")
        
    auth_state = AUTH_STATES.get(state, {})
    mode = auth_state.get("mode", "connect")
    cid = auth_state.get("client_id", ZOHO_CLIENT_ID)
    csecret = auth_state.get("client_secret", ZOHO_CLIENT_SECRET)
    
    resp = requests.post(f"{ZOHO_ACCOUNTS_URL}/oauth/v2/token", data={
        "grant_type": "authorization_code",
        "client_id": cid,
        "client_secret": csecret,
        "redirect_uri": ZOHO_REDIRECT_URI,
        "code": code
    })
    data = resp.json()
    if "error" in data:
        raise HTTPException(400, f"Token exchange failed: {data['error']}")
    
    # Get Zoho account info with the new tokens
    headers = {"Authorization": f"Zoho-oauthtoken {data['access_token']}", "Content-Type": "application/json"}
    acc_resp = requests.get(ZOHO_API_URL, headers=headers).json()
    email, display_name, zoho_acc_id = "", "Connected Account", ""
    if acc_resp.get("data"):
        acc = acc_resp["data"][0]
        email = acc.get("primaryEmailAddress", "")
        display_name = acc.get("displayName", email)
        zoho_acc_id = acc.get("accountId", "")
    
    # Save to multi-account store
    all_data = load_all_accounts()
    existing = next((a for a in all_data["accounts"] if a.get("email") == email), None)
    is_first = len(all_data["accounts"]) == 0
    
    if existing:
        existing["tokens"] = data  # Update tokens
        existing["client_id"] = cid
        existing["client_secret"] = csecret
    else:
        all_data["accounts"].append({
            "id": str(uuid.uuid4()),
            "email": email,
            "displayName": display_name,
            "accountId": zoho_acc_id,
            "tokens": data,
            "client_id": cid,
            "client_secret": csecret,
            "isDefault": is_first,
            "connectedAt": datetime.utcnow().isoformat()
        })
    save_all_accounts(all_data)
    save_tokens(data)  # Legacy fallback
    
    if state in AUTH_STATES:
        del AUTH_STATES[state]
        
    return RedirectResponse(f"{FRONTEND_URL}?zoho_auth=success&mode={mode}")

@app.get("/api/zoho/status")
def get_zoho_status():
    tokens = load_tokens()
    return {"connected": bool(tokens and "access_token" in tokens)}

# ─── Connected Accounts Management ───────────────────────────────────────────

@app.get("/api/zoho/connected-accounts")
def get_connected_accounts():
    data = load_all_accounts()
    return {"accounts": [
        {"id": a["id"], "email": a.get("email",""), "displayName": a.get("displayName",""),
         "accountId": a.get("accountId",""), "isDefault": a.get("isDefault", False),
         "connectedAt": a.get("connectedAt","")}
        for a in data.get("accounts", [])
    ]}

@app.delete("/api/zoho/connected-accounts/{acc_id}")
def disconnect_account(acc_id: str):
    data = load_all_accounts()
    data["accounts"] = [a for a in data["accounts"] if a["id"] != acc_id]
    if data["accounts"] and not any(a.get("isDefault") for a in data["accounts"]):
        data["accounts"][0]["isDefault"] = True
    save_all_accounts(data)
    return {"status": "success"}

@app.put("/api/zoho/connected-accounts/{acc_id}/default")
def set_default_account(acc_id: str):
    data = load_all_accounts()
    for a in data["accounts"]:
        a["isDefault"] = (a["id"] == acc_id)
    save_all_accounts(data)
    return {"status": "success"}

# ─── Account ─────────────────────────────────────────────────────────────────

@app.get("/api/zoho/account")
def get_account(account_id: str = None):
    _, account = get_account_info(account_id)
    return {"data": account}

# ─── Folders ─────────────────────────────────────────────────────────────────

@app.get("/api/zoho/folders")
def get_folders(account_id: str = None):
    zoho_account_id, _ = get_account_info(account_id)
    data, status = zoho_api_request("GET", f"{ZOHO_MAIL_API}/accounts/{zoho_account_id}/folders", account_id=account_id)
    return data if status == 200 else {"data": []}

@app.post("/api/zoho/folders")
def create_folder(req: CreateFolderRequest, account_id: str = None):
    zoho_account_id, _ = get_account_info(account_id)
    payload = {"folderName": req.folderName}
    if req.parentId:
        payload["parentId"] = req.parentId
    data, status = zoho_api_request("POST", f"{ZOHO_MAIL_API}/accounts/{zoho_account_id}/folders", json_payload=payload, account_id=account_id)
    if status != 200:
        raise HTTPException(status_code=status, detail=f"Failed: {data}")
    return data

# ─── Labels / Tags ───────────────────────────────────────────────────────────

@app.get("/api/zoho/labels")
def get_labels(account_id: str = None):
    zoho_account_id, _ = get_account_info(account_id)
    data, status = zoho_api_request("GET", f"{ZOHO_MAIL_API}/accounts/{zoho_account_id}/tags", account_id=account_id)
    return data if status == 200 else {"data": []}

# ─── Signatures ──────────────────────────────────────────────────────────────

@app.get("/api/zoho/signatures")
def get_signatures(account_id: str = None):
    zoho_account_id, _ = get_account_info(account_id)
    data, status = zoho_api_request("GET", f"{ZOHO_MAIL_API}/accounts/{zoho_account_id}/signatures", account_id=account_id)
    return data if status == 200 else {"data": []}

# ─── Email List ──────────────────────────────────────────────────────────────

@app.get("/api/zoho/mail")
def get_emails(folder_id: str = None, label_id: str = None, limit: int = 30, start: int = 1, account_id: str = None):
    zoho_account_id, _ = get_account_info(account_id)
    url = f"{ZOHO_MAIL_API}/accounts/{zoho_account_id}/messages/view?limit={limit}&start={start}"
    if folder_id:
        url += f"&folderId={folder_id}"
    if label_id:
        url += f"&labelId={label_id}"
    data, status = zoho_api_request("GET", url, account_id=account_id)
    if status != 200:
        raise HTTPException(status_code=status, detail=f"Failed: {data}")
    return {"emails": data.get("data", [])}

@app.get("/api/zoho/search")
def search_emails(search_key: str, limit: int = 30, account_id: str = None):
    zoho_account_id, _ = get_account_info(account_id)
    url = f"{ZOHO_MAIL_API}/accounts/{zoho_account_id}/messages/search?searchKey={search_key}&limit={limit}"
    data, status = zoho_api_request("GET", url, account_id=account_id)
    if status != 200:
        raise HTTPException(status_code=status, detail=f"Search failed: {data}")
    return {"emails": data.get("data", [])}

# ─── Email Detail ─────────────────────────────────────────────────────────────

import mimetypes

@app.get("/api/zoho/mail/attachments/download")
def download_attachment(message_id: str, attachment_id: str, filename: str, folder_id: str = None, account_id: str = None):
    zoho_account_id, _ = get_account_info(account_id)
    fid = resolve_folder_id(zoho_account_id, message_id, folder_id)
    if not fid:
        raise HTTPException(400, "Could not resolve folder ID")
    url = f"{ZOHO_MAIL_API}/accounts/{zoho_account_id}/folders/{fid}/messages/{message_id}/attachments/{attachment_id}"
    tokens = get_account_tokens(account_id)
    if not tokens or "access_token" not in tokens:
        raise HTTPException(401, "No tokens for this account")
    resp = requests.get(url, headers={"Authorization": f"Zoho-oauthtoken {tokens['access_token']}"}, stream=True)
    if resp.status_code == 401:
        new_token = refresh_zoho_token(account_id)
        if new_token:
            resp = requests.get(url, headers={"Authorization": f"Zoho-oauthtoken {new_token}"}, stream=True)
    if resp.status_code != 200:
        raise HTTPException(resp.status_code, "Failed to download attachment")
        
    mime_type, _ = mimetypes.guess_type(filename)
    if not mime_type:
        mime_type = "application/octet-stream"
        
    return StreamingResponse(
        resp.iter_content(chunk_size=8192),
        media_type=mime_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'}
    )

@app.get("/api/zoho/mail/{message_id}")
def get_email_detail(message_id: str, folder_id: str = None, account_id: str = None):
    zoho_account_id, _ = get_account_info(account_id)
    fid = resolve_folder_id(zoho_account_id, message_id, folder_id)

    # Get content
    if fid:
        content_url = f"{ZOHO_MAIL_API}/accounts/{zoho_account_id}/folders/{fid}/messages/{message_id}/content"
    else:
        content_url = f"{ZOHO_MAIL_API}/accounts/{zoho_account_id}/messages/{message_id}/content"
    content_data, status = zoho_api_request("GET", content_url, account_id=account_id)
    if status != 200:
        raise HTTPException(status_code=status, detail=f"Failed to get content: {content_data}")

    # Get attachments
    if fid:
        att_url = f"{ZOHO_MAIL_API}/accounts/{zoho_account_id}/folders/{fid}/messages/{message_id}/attachmentinfo"
        att_data, _ = zoho_api_request("GET", att_url, account_id=account_id)
        if att_data and "data" in att_data:
            if "data" not in content_data:
                content_data["data"] = {}
            atts = att_data["data"]
            content_data["data"]["attachments"] = atts.get("attachments", []) if isinstance(atts, dict) else []
            content_data["data"]["folderId"] = fid

    return content_data

# ─── Send / Reply ─────────────────────────────────────────────────────────────

@app.post("/api/zoho/mail/send")
def send_email(req: SendEmailRequest):
    account_id, account = get_account_info()
    payload = {
        "fromAddress": account["primaryEmailAddress"],
        "toAddress": req.toAddress,
        "subject": req.subject,
        "content": req.content,
        "mailFormat": "html"
    }
    if req.ccAddress:  payload["ccAddress"] = req.ccAddress
    if req.bccAddress: payload["bccAddress"] = req.bccAddress
    if req.attachments: payload["attachments"] = req.attachments
    data, status = zoho_api_request("POST", f"{ZOHO_MAIL_API}/accounts/{account_id}/messages", json_payload=payload)
    if status != 200:
        raise HTTPException(status_code=status, detail=f"Failed to send: {data}")
    return {"status": "success"}

@app.post("/api/zoho/mail/reply")
def reply_email(req: ReplyEmailRequest):
    account_id, account = get_account_info()
    payload = {
        "fromAddress": account["primaryEmailAddress"],
        "toAddress": req.toAddress,
        "subject": req.subject,
        "content": req.content,
        "mailFormat": "html",
        "isForward": req.isForward
    }
    if req.ccAddress: payload["ccAddress"] = req.ccAddress
    if req.attachments: payload["attachments"] = req.attachments
    url = f"{ZOHO_MAIL_API}/accounts/{account_id}/messages/{req.messageId}"
    data, status = zoho_api_request("POST", url, json_payload=payload)
    if status != 200:
        raise HTTPException(status_code=status, detail=f"Failed: {data}")
    return {"status": "success"}

@app.post("/api/zoho/mail/draft")
def save_draft(req: DraftRequest):
    account_id, account = get_account_info()
    payload = {
        "fromAddress": account["primaryEmailAddress"],
        "toAddress": req.toAddress,
        "subject": req.subject,
        "content": req.content,
        "mailFormat": "html",
        "saveInSent": "false",
        "isDraft": "true"
    }
    data, status = zoho_api_request("POST", f"{ZOHO_MAIL_API}/accounts/{account_id}/messages", json_payload=payload)
    if status != 200:
        raise HTTPException(status_code=status, detail=f"Draft save failed: {data}")
    return {"status": "success", "data": data}

# ─── Email Actions ────────────────────────────────────────────────────────────

@app.put("/api/zoho/mail/update")
def update_messages(req: UpdateMessageRequest):
    """Generic update: mark read/unread, flag, move, spam."""
    account_id, _ = get_account_info()
    payload = {"mode": req.mode, "messageId": req.messageIds}
    if req.folderId: payload["folderId"] = req.folderId
    data, status = zoho_api_request("PUT", f"{ZOHO_MAIL_API}/accounts/{account_id}/updatemessage", json_payload=payload)
    if status != 200:
        raise HTTPException(status_code=status, detail=f"Update failed: {data}")
    return {"status": "success"}

@app.post("/api/zoho/mail/{message_id}/label")
def add_label(message_id: str, req: LabelRequest, folder_id: str = None):
    account_id, _ = get_account_info()
    fid = resolve_folder_id(account_id, message_id, folder_id)
    if not fid:
        raise HTTPException(400, "Could not resolve folder ID for label operation")
    payload = {"tagId": req.tagId}
    url = f"{ZOHO_MAIL_API}/accounts/{account_id}/folders/{fid}/messages/{message_id}"
    data, status = zoho_api_request("PUT", url, json_payload=payload)
    return {"status": "success" if status == 200 else "failed", "data": data}

@app.delete("/api/zoho/mail/{message_id}/label/{tag_id}")
def remove_label(message_id: str, tag_id: str, folder_id: str = None):
    account_id, _ = get_account_info()
    fid = resolve_folder_id(account_id, message_id, folder_id)
    url = f"{ZOHO_MAIL_API}/accounts/{account_id}/folders/{fid}/messages/{message_id}"
    data, status = zoho_api_request("PUT", url, json_payload={"tagId": tag_id, "removeTag": "true"})
    return {"status": "success" if status == 200 else "failed"}

@app.delete("/api/zoho/mail/{message_id}")
def delete_email(message_id: str):
    account_id, _ = get_account_info()
    data, status = zoho_api_request("DELETE", f"{ZOHO_MAIL_API}/accounts/{account_id}/messages/{message_id}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"Delete failed: {data}")
    return {"status": "success"}

# ─── Attachments ──────────────────────────────────────────────────────────────

@app.post("/api/zoho/mail/attachments")
async def upload_attachment(file: UploadFile = File(...)):
    account_id, _ = get_account_info()
    content = await file.read()
    data, status = zoho_upload_attachment(account_id, file.filename, content)
    if status != 200:
        raise HTTPException(status_code=status, detail=f"Upload failed: {data}")
    return data

# ─── Bulk Automail ────────────────────────────────────────────────────────────

# In-memory campaign store — loaded from disk on startup
CAMPAIGNS: dict = load_campaigns()

@app.get("/api/zoho/automail/status")
def get_campaigns_status():
    return {"campaigns": [
        {"id": cid, "type": "email", **{k: v for k, v in c.items() if k not in ("rows", "message_template", "attachment_info", "local_attachment_path", "local_attachment_name", "zoho_account_id", "internal_account_id", "email_col")}}
        for cid, c in CAMPAIGNS.items()
    ]}

@app.post("/api/zoho/automail/bulk")
async def send_bulk_automail(
    background_tasks: BackgroundTasks,
    csv_file: UploadFile = File(...),
    attachment: UploadFile = File(None),
    subject: str = Form(...),
    message: str = Form(...),
    account_id: str = Form(None)
):
    zoho_account_id, account = get_account_info(account_id)
    from_address = account["primaryEmailAddress"]

    # Save attachment locally
    local_attachment_path = None
    local_attachment_name = None
    if attachment and attachment.filename:
        content = await attachment.read()
        os.makedirs(os.path.join(DATA_DIR, "automail_attachments"), exist_ok=True)
        local_attachment_name = attachment.filename
        local_attachment_path = os.path.join(DATA_DIR, "automail_attachments", f"{uuid.uuid4()}_{attachment.filename}")
        with open(local_attachment_path, "wb") as f:
            f.write(content)

    file_content = await csv_file.read()
    try:
        if csv_file.filename.lower().endswith('.csv'):
            df = pd.read_csv(io.BytesIO(file_content))
        else:
            df = pd.read_excel(io.BytesIO(file_content))
    except Exception as e:
        raise HTTPException(400, f"Failed to parse file: {e}")

    email_col = next((c for c in df.columns if c.lower() in ['email', 'e-mail', 'email address', 'emailaddress', 'contact email']), None)
    if not email_col:
        raise HTTPException(400, "CSV must have an 'Email' column (e.g. Email, e-mail, Email Address)")

    df = df.dropna(subset=[email_col])
    rows = df.to_dict('records')
    valid_rows = [r for r in rows if '@' in str(r.get(email_col, ''))]

    if not valid_rows:
        raise HTTPException(400, "No valid email addresses found in the CSV.")

    campaign_id = str(uuid.uuid4())
    CAMPAIGNS[campaign_id] = {
        "total": len(valid_rows),
        "success": 0,
        "failed": 0,
        "errors": [],
        "status": "running",
        "subject": subject,
        "started_at": datetime.utcnow().isoformat(),
        "from_email": from_address,
        "rows": valid_rows,
        "email_col": email_col,
        "message_template": message,
        "local_attachment_path": local_attachment_path,
        "local_attachment_name": local_attachment_name,
        "zoho_account_id": zoho_account_id,
        "internal_account_id": account_id,
    }

    background_tasks.add_task(process_automail_campaign, campaign_id)
    save_campaigns(CAMPAIGNS)
    return {"campaign_id": campaign_id, "total": len(valid_rows), "status": "running"}


async def process_automail_campaign(campaign_id: str):
    if EMAILS_DISABLED:
        print(f"[AutoMail] Campaign {campaign_id} BLOCKED by kill switch.")
        camp = CAMPAIGNS.get(campaign_id)
        if camp: camp["status"] = "disabled"
        return
    camp = CAMPAIGNS.get(campaign_id)
    if not camp:
        return

    zoho_account_id = camp["zoho_account_id"]
    internal_account_id = camp["internal_account_id"]
    from_address = camp["from_email"]
    email_col = camp["email_col"]
    import smtplib, ssl, mimetypes
    from email.message import EmailMessage

    smtp_port = 587
    smtp_server = "smtp.zeptomail.in"
    username = "emailapikey"
    password = "PHtE6r0OQOjoijR5oRFSs/a9Ec/3Ydkoqb5hJVERsYdFDvNSTk1TqdopkTS2qU9/U/YUQfCSwIs+47rJseLTLGzkZ21IXGqyqK3sx/VYSPOZsbq6x00cs1oScEbdVo/netRp1S3RvtbbNA=="

    local_att_path = camp.get("local_attachment_path")
    local_att_name = camp.get("local_attachment_name")

    for row in camp["rows"]:
        to_email = str(row.get(email_col, '')).strip()
        row_subject = camp["subject"]
        row_message = camp["message_template"]

        for col, val in row.items():
            placeholder = f"{{{col}}}"
            val_str = str(val) if pd.notna(val) else ""
            row_subject = row_subject.replace(placeholder, val_str)
            row_message = row_message.replace(placeholder, val_str)

        msg = EmailMessage()
        msg['Subject'] = row_subject
        msg['To'] = to_email
        msg['From'] = from_address
        
        msg.set_content(row_message.replace("<br>", "\n"))
        msg.add_alternative(row_message.replace("\n", "<br>"), subtype='html')

        if local_att_path and os.path.exists(local_att_path):
            with open(local_att_path, 'rb') as f:
                att_data = f.read()
            mime_type, _ = mimetypes.guess_type(local_att_name)
            mime_type = mime_type or 'application/octet-stream'
            maintype, subtype = mime_type.split('/', 1)
            msg.add_attachment(att_data, maintype=maintype, subtype=subtype, filename=local_att_name)

        try:
            with smtplib.SMTP(smtp_server, smtp_port) as server:
                server.starttls()
                server.login(username, password)
                server.send_message(msg)
            CAMPAIGNS[campaign_id]["success"] += 1
        except Exception as e:
            CAMPAIGNS[campaign_id]["failed"] += 1
            CAMPAIGNS[campaign_id]["errors"].append(f"{to_email}: {str(e)}")

        processed = CAMPAIGNS[campaign_id]["success"] + CAMPAIGNS[campaign_id]["failed"]
        if processed % 10 == 0:
            save_campaigns(CAMPAIGNS)

        import random
        await asyncio.sleep(random.uniform(5, 15))

    CAMPAIGNS[campaign_id]["status"] = "completed"
    CAMPAIGNS[campaign_id]["finished_at"] = datetime.utcnow().isoformat()
    save_campaigns(CAMPAIGNS)
    print(f"[AutoMail] Campaign {campaign_id} done — {CAMPAIGNS[campaign_id]['success']} sent, {CAMPAIGNS[campaign_id]['failed']} failed.")

# ─── WhatsApp (DISABLED) ──────────────────────────────────────────────────────

@app.get("/api/whatsapp/status")
def get_wa_status():
    return {"status": "disabled", "message": "WhatsApp service is not available in this deployment."}

@app.get("/api/whatsapp/campaigns")
def get_wa_campaigns():
    return {"campaigns": []}

# ─── Scheduler ─────────────────────────────────────────────────────────────────
import shutil
import aiofiles

SCHEDULED_JOBS_FILE = os.path.join(DATA_DIR, "scheduled_jobs.json")
SCHEDULED_DIR = os.path.join(DATA_DIR, "scheduled_csvs")
os.makedirs(SCHEDULED_DIR, exist_ok=True)

def load_scheduled_jobs():
    if os.path.exists(SCHEDULED_JOBS_FILE):
        try:
            with open(SCHEDULED_JOBS_FILE, 'r') as f:
                return json.load(f)
        except Exception:
            pass
    return []

def save_scheduled_jobs(jobs):
    with open(SCHEDULED_JOBS_FILE, 'w') as f:
        json.dump(jobs, f, indent=2)

@app.get("/api/schedule")
def get_scheduled_jobs():
    jobs = load_scheduled_jobs()
    return {"jobs": jobs}

@app.post("/api/schedule")
async def schedule_job(
    csv_file: UploadFile = File(...),
    type: str = Form(...),
    target_datetime: str = Form(...),
    message: str = Form(...),
    subject: str = Form(None),
    account_id: str = Form(None),
    attachment: UploadFile = File(None)
):
    job_id = str(uuid.uuid4())
    ext = os.path.splitext(csv_file.filename)[1]
    save_path = os.path.join(SCHEDULED_DIR, f"{job_id}{ext}")
    
    async with aiofiles.open(save_path, 'wb') as out_file:
        content = await csv_file.read()
        await out_file.write(content)
        
    att_path = None
    if attachment:
        att_ext = os.path.splitext(attachment.filename)[1]
        att_path = os.path.join(SCHEDULED_DIR, f"{job_id}_att{att_ext}")
        async with aiofiles.open(att_path, 'wb') as att_file:
            att_content = await attachment.read()
            await att_file.write(att_content)

    jobs = load_scheduled_jobs()
    new_job = {
        "id": job_id,
        "type": type,
        "target_datetime": target_datetime,
        "message": message,
        "subject": subject,
        "account_id": account_id,
        "file_path": save_path,
        "attachment_path": att_path,
        "attachment_filename": attachment.filename if attachment else None,
        "status": "pending",
        "created_at": datetime.utcnow().isoformat()
    }
    jobs.append(new_job)
    save_scheduled_jobs(jobs)
    return {"status": "success", "job_id": job_id}

@app.delete("/api/schedule/{job_id}")
def delete_scheduled_job(job_id: str):
    jobs = load_scheduled_jobs()
    job = next((j for j in jobs if j["id"] == job_id), None)
    if not job:
        raise HTTPException(404, "Job not found")
        
    jobs = [j for j in jobs if j["id"] != job_id]
    save_scheduled_jobs(jobs)
    
    if os.path.exists(job["file_path"]):
        try: os.remove(job["file_path"])
        except: pass
    
    if job.get("attachment_path") and os.path.exists(job["attachment_path"]):
        try: os.remove(job["attachment_path"])
        except: pass
            
    return {"status": "success"}

@app.on_event("startup")
async def startup_event():
    # asyncio.create_task(scheduler_loop()) # DISABLED TO STOP UNWANTED MAILS
    pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
