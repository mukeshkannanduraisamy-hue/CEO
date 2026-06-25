import os
import pandas as pd

# File paths
input_file = r"C:\Users\Admin\Documents\CEO\large_automail_whatapp 05-05-2026.csv"
base_dir = r"C:\Users\Admin\Documents\CEO\Campaign_Batches"
email_dir = os.path.join(base_dir, "Email_Batches_400")
wa_dir = os.path.join(base_dir, "WhatsApp_Batches_150")

# Create folders
os.makedirs(email_dir, exist_ok=True)
os.makedirs(wa_dir, exist_ok=True)

# Read CSV
df = pd.read_csv(input_file)

# Split for Email (400 per file)
email_chunk_size = 400
for i in range(0, len(df), email_chunk_size):
    chunk = df.iloc[i:i + email_chunk_size]
    chunk.to_csv(os.path.join(email_dir, f"Email_Batch_{i//email_chunk_size + 1}.csv"), index=False)

# Split for WhatsApp (150 per file)
wa_chunk_size = 150
for i in range(0, len(df), wa_chunk_size):
    chunk = df.iloc[i:i + wa_chunk_size]
    chunk.to_csv(os.path.join(wa_dir, f"WhatsApp_Batch_{i//wa_chunk_size + 1}.csv"), index=False)

print(f"Successfully split {len(df)} contacts!")
print(f"- Created {len(range(0, len(df), email_chunk_size))} files for Email")
print(f"- Created {len(range(0, len(df), wa_chunk_size))} files for WhatsApp")
