import smtplib, ssl
from email.message import EmailMessage
port = 587
smtp_server = "smtp.zeptomail.in"
username="emailapikey"
password = "PHtE6r0EFu3oiW8v+xQB4aS5FpWtYIp7/b4yLlIWt4xGA6QLTE0D/919wWDkq014A/JDR6GfzI1q5bOVsO2FIm7rNmcaVWqyqK3sx/VYSPOZsbq6x00VtF4cdk3VUI7net5v1yzRstvaNA=="

message = "Test email sent successfully."
msg = EmailMessage()
msg['Subject'] = "Test Email"
msg['To'] = "mukesh@varaahigroups.com"
msg['From'] = "rahini.varaahi@varaahigroups.com"
msg.set_content(message)
try:
    if port == 465:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(smtp_server, port, context=context) as server:
            server.login(username, password)
            server.send_message(msg)
    elif port == 587:
        with smtplib.SMTP(smtp_server, port) as server:
            server.starttls()
            server.login(username, password)
            server.send_message(msg)
    else:
        print ("use 465 / 587 as port value")
        exit()
    print ("successfully sent")
except Exception as e:
    print (e)
