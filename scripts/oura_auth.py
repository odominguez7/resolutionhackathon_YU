"""
Oura OAuth2 flow — get an access token for your account.

Usage:
    python scripts/oura_auth.py <client_id> <client_secret>

This will:
1. Open your browser to authorize the app
2. Start a local server to catch the callback
3. Exchange the code for an access token
4. Save the token to .env
"""

import sys
import os
import webbrowser
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler
import requests

REDIRECT_URI = "http://localhost:9999/callback"
AUTH_URL = "https://cloud.ouraring.com/oauth/authorize"
TOKEN_URL = "https://api.ouraring.com/oauth/token"

SCOPES = "personal daily heartrate workout session spo2 ring_configuration stress resilience email"

auth_code = None


class CallbackHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        global auth_code
        query = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(query)

        if "code" in params:
            auth_code = params["code"][0]
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(b"<html><body><h1>Success! You can close this tab.</h1><p>YU RestOS has your Oura authorization.</p></body></html>")
        else:
            self.send_response(400)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(b"<html><body><h1>Error</h1><p>No authorization code received.</p></body></html>")

    def log_message(self, format, *args):
        pass  # Suppress server logs


def main():
    if len(sys.argv) < 3:
        print("Usage: python scripts/oura_auth.py <client_id> <client_secret>")
        sys.exit(1)

    client_id = sys.argv[1]
    client_secret = sys.argv[2]

    # Step 1: Open browser for authorization
    auth_params = urllib.parse.urlencode({
        "client_id": client_id,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": SCOPES,
        "state": "yurestos",
    })
    auth_full_url = f"{AUTH_URL}?{auth_params}"

    print("Opening browser for Oura authorization...")
    print(f"If browser doesn't open, go to:\n{auth_full_url}\n")
    webbrowser.open(auth_full_url)

    # Step 2: Wait for callback
    print("Waiting for authorization callback on http://localhost:9999 ...")
    server = HTTPServer(("localhost", 9999), CallbackHandler)
    server.handle_request()

    if not auth_code:
        print("ERROR: No authorization code received.")
        sys.exit(1)

    print(f"Got authorization code: {auth_code[:10]}...")

    # Step 3: Exchange code for token
    print("Exchanging code for access token...")
    response = requests.post(TOKEN_URL, data={
        "grant_type": "authorization_code",
        "code": auth_code,
        "redirect_uri": REDIRECT_URI,
        "client_id": client_id,
        "client_secret": client_secret,
    })

    if response.status_code != 200:
        print(f"ERROR: Token exchange failed: {response.status_code}")
        print(response.text)
        sys.exit(1)

    token_data = response.json()
    access_token = token_data["access_token"]
    refresh_token = token_data.get("refresh_token", "")

    # Step 4: Save to .env
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    with open(env_path, "a") as f:
        f.write(f"\nOURA_ACCESS_TOKEN={access_token}\n")
        if refresh_token:
            f.write(f"OURA_REFRESH_TOKEN={refresh_token}\n")

    print(f"\nAccess token saved to {env_path}")
    print(f"Token: {access_token[:20]}...")
    print("\nNow run: python scripts/oura_export.py")


if __name__ == "__main__":
    main()
