import os
import subprocess
import sys
import glob
import shutil

domains_dir = "/home/u403881955/domains"

def find_env(domain):
    candidates = [
        f"{domains_dir}/{domain}/hbuilds/config/.env",
        f"{domains_dir}/{domain}/.env",
        f"{domains_dir}/{domain}/public_html/.env"
    ]
    for c in candidates:
        if os.path.isfile(c):
            return c
    return None

def parse_env(path):
    env = {}
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k = k.strip()
            v = v.strip().strip("'\"")
            env[k] = v
    return env

ppl_env_path = find_env("pplapi.kcnanja.com")
beta_env_path = find_env("betapplapi.kcnanja.com")

print(f"PPL ENV: {ppl_env_path}")
print(f"BETA ENV: {beta_env_path}")

if not ppl_env_path or not beta_env_path:
    print("ERROR: Could not find .env files!")
    sys.exit(1)

# Fix CORS on beta
with open(beta_env_path, "r", encoding="utf-8") as f:
    beta_lines = f.readlines()
with open(beta_env_path, "w", encoding="utf-8") as f:
    for line in beta_lines:
        if line.startswith("CORS_ORIGIN="):
            f.write("CORS_ORIGIN=https://betappl.kcnanja.com\n")
        else:
            f.write(line)
print("Updated CORS_ORIGIN in beta .env to https://betappl.kcnanja.com")

ppl_cfg = parse_env(ppl_env_path)
beta_cfg = parse_env(beta_env_path)

src_user = ppl_cfg.get("DB_USER")
src_pass = ppl_cfg.get("DB_PASSWORD")
src_db = ppl_cfg.get("DB_NAME")
src_host = ppl_cfg.get("DB_HOST", "127.0.0.1")

dst_user = beta_cfg.get("DB_USER")
dst_pass = beta_cfg.get("DB_PASSWORD")
dst_db = beta_cfg.get("DB_NAME")
dst_host = beta_cfg.get("DB_HOST", "127.0.0.1")

print(f"Source DB: {src_db} @ {src_host}")
print(f"Target DB: {dst_db} @ {dst_host}")

# 1. Dump source
dump_file = "/tmp/ppl_sync_dump.sql"
dump_cmd = [
    "mysqldump",
    f"-h{src_host}",
    f"-u{src_user}",
    f"-p{src_pass}",
    "--single-transaction",
    "--quick",
    "--routines",
    "--triggers",
    src_db
]

print("Starting mysqldump...")
with open(dump_file, "w") as out_f:
    p = subprocess.run(dump_cmd, stdout=out_f, stderr=subprocess.PIPE, text=True)
    if p.returncode != 0:
        print(f"mysqldump error: {p.stderr}")
        sys.exit(1)

dump_size = os.path.getsize(dump_file)
print(f"Dump successful: {dump_size} bytes")

# 2. Import target
import_cmd = [
    "mysql",
    f"-h{dst_host}",
    f"-u{dst_user}",
    f"-p{dst_pass}",
    dst_db
]
print("Starting mysql import into target DB...")
with open(dump_file, "r") as in_f:
    p2 = subprocess.run(import_cmd, stdin=in_f, stderr=subprocess.PIPE, text=True)
    if p2.returncode != 0:
        print(f"mysql import error: {p2.stderr}")
        sys.exit(1)
print("Import into target DB successful!")

# 3. Sync uploads
src_uploads = f"{domains_dir}/pplapi.kcnanja.com/storage/uploads"
dst_uploads = f"{domains_dir}/betapplapi.kcnanja.com/storage/uploads"
if os.path.isdir(src_uploads):
    os.makedirs(dst_uploads, exist_ok=True)
    for root, dirs, files in os.walk(src_uploads):
        rel = os.path.relpath(root, src_uploads)
        target_dir = os.path.join(dst_uploads, rel)
        os.makedirs(target_dir, exist_ok=True)
        for f in files:
            s_file = os.path.join(root, f)
            d_file = os.path.join(target_dir, f)
            if not os.path.exists(d_file) or os.path.getmtime(s_file) > os.path.getmtime(d_file):
                shutil.copy2(s_file, d_file)
    print("Synced storage/uploads successfully!")

# 4. Restart Passenger / Node
restart_txt = f"{domains_dir}/betapplapi.kcnanja.com/tmp/restart.txt"
os.makedirs(os.path.dirname(restart_txt), exist_ok=True)
with open(restart_txt, "w") as f:
    f.write("restart")

hbuilds_restart = f"{domains_dir}/betapplapi.kcnanja.com/hbuilds/current/nodejs/tmp/restart.txt"
if os.path.isdir(os.path.dirname(hbuilds_restart)):
    with open(hbuilds_restart, "w") as f:
        f.write("restart")

print("Restart touched successfully!")
print("=== DATABASE & UPLOADS SYNC COMPLETED SUCCESSFULLY ===")
