import json, time, urllib.request, urllib.error, jwt
KEY_ID="54F786QLW9"; ISSUER="d4043b84-ff32-4cd9-bef8-a0d183c13991"
KEY=open("/Users/monsegueadah/.appstoreconnect/private_keys/AuthKey_54F786QLW9.p8").read()
def token(): return jwt.encode({"iss":ISSUER,"iat":int(time.time()),"exp":int(time.time())+900,"aud":"appstoreconnect-v1"},KEY,algorithm="ES256",headers={"kid":KEY_ID,"typ":"JWT"})
def call(method,path,body=None):
    data=json.dumps(body).encode() if body else None
    req=urllib.request.Request("https://api.appstoreconnect.apple.com"+path,data=data,method=method,
        headers={"Authorization":f"Bearer {token()}","Content-Type":"application/json"})
    try:
        raw=urllib.request.urlopen(req,timeout=45).read(); return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e: raise RuntimeError(f"{method} {path} -> {e.code}: {e.read().decode()[:300]}")

HOME = ("Demo account - NO OTP required (sign in directly):\n"
        "Email: reviewer@taptarea.com\n"
        "Password: Review123!\n\n"
        "ACCOUNT DELETION (Guideline 5.1.1) - PLEASE USE THE SEPARATE ACCOUNT BELOW:\n"
        "Email: delete-me@taptarea.com\n"
        "Password: DeleteDemo2026!\n"
        "Sign in with that account, tap the \"Profile\" tab (bottom-right), scroll to the BOTTOM, "
        "tap the red \"Delete Account\" button (directly below \"Sign Out\"), then confirm.\n"
        "Deletion is a permanent erase, so this second account exists purely to be deleted - "
        "please do not delete the main demo account above, as it is needed for future reviews.")

PRO = ("Demo account - NO OTP required (sign in directly):\n"
       "Email: test@taptarea.com\n"
       "Password: TareaTest2026!\n\n"
       "ACCOUNT DELETION (Guideline 5.1.1) - PLEASE USE THE SEPARATE ACCOUNT BELOW:\n"
       "Email: delete-me-pro@taptarea.com\n"
       "Password: DeleteDemo2026!\n"
       "Sign in with that account, you land on the Dashboard. Under \"Quick Actions\" tap \"Profile\", "
       "scroll to the BOTTOM, tap the red \"Delete Account\" button (below \"Sign Out\"), then confirm.\n"
       "Deletion is a permanent erase, so this second account exists purely to be deleted - "
       "please do not delete the main demo account above, as it is needed for future reviews.\n\n"
       "NOTE ON PAYOUTS: the demo pro has not completed Stripe payout onboarding, so \"Find Jobs\" will ask "
       "to finish payout setup before applying to a job. All other functionality - dashboard, profile, "
       "services, availability, messages, notifications and account deletion - is available.")

for vid, name, notes, demo, pw in [
    ("2c717238-ad81-496a-b441-d373f8561d81","Tarea Home",HOME,"reviewer@taptarea.com","Review123!"),
    ("6a59ca37-9abf-4064-bd3e-40e3a9bfcccf","Tarea Pro", PRO,"test@taptarea.com","TareaTest2026!")]:
    d=call("GET", f"/v1/appStoreVersions/{vid}/appStoreReviewDetail")["data"]
    call("PATCH", f"/v1/appStoreReviewDetails/{d['id']}", {"data":{"type":"appStoreReviewDetails","id":d["id"],
        "attributes":{"demoAccountName":demo,"demoAccountPassword":pw,"demoAccountRequired":True,"notes":notes}}})
    now=call("GET", f"/v1/appStoreVersions/{vid}/appStoreReviewDetail")["data"]["attributes"]
    print(f"{name}: demo={now['demoAccountName']} | notes mention delete account: {'delete-me' in (now.get('notes') or '')}")
