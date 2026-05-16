import json
import urllib.request

payload = json.dumps({"username": "admin", "password": "admin123"}).encode('utf-8')
req = urllib.request.Request(
    'http://127.0.0.1:8000/api/login/',
    data=payload,
    headers={'Content-Type': 'application/json'}
)
try:
    response = urllib.request.urlopen(req)
    data = json.loads(response.read())
    print("Status:", response.status)
    print("Response:", json.dumps(data, indent=2))
except urllib.error.HTTPError as e:
    print("Error Status:", e.code)
    print("Error Body:", e.read().decode())
