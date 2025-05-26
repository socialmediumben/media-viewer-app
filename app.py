from flask import Flask, render_template, jsonify, send_from_directory
import requests
import json
import time
import os # Ensure os is imported for environment variables if you're using them

app = Flask(__name__)

# --- Configuration for Google Apps Script Web App URL ---
# IMPORTANT: This should be your deployed Google Apps Script Web App URL.
# Ensure it matches the URL from your Render environment variable or the hardcoded fallback.
GOOGLE_APPS_SCRIPT_API_URL = os.environ.get("GOOGLE_APPS_SCRIPT_API_URL", "https://script.google.com/macros/s/AKfycbzdY1BVrU_LbHVRHZnWClhyCTbVQzQ2A5kY_D40aZMLj-SncTaC4YTJGDEy1wnjcRHL8Q/exec")

if GOOGLE_APPS_SCRIPT_API_URL == "YOUR_ACTUAL_GOOGLE_APPS_SCRIPT_URL_HERE": # Fallback placeholder check
    print("WARNING: GOOGLE_APPS_SCRIPT_API_URL environment variable not set. Using placeholder. Media data fetching will fail locally.")

# --- Load MEDIA_DATABASE from Google Apps Script API ---
MEDIA_DATABASE = {}

def fetch_media_data_from_google_sheet():
    """Fetches media data from the Google Apps Script API."""
    global MEDIA_DATABASE
    print(f"Attempting to fetch media data from: {GOOGLE_APPS_SCRIPT_API_URL}")
    try:
        if GOOGLE_APPS_SCRIPT_API_URL == "YOUR_ACTUAL_GOOGLE_APPS_SCRIPT_URL_HERE": # Check placeholder
            print("Skipping GAS fetch: API URL not set.")
            MEDIA_DATABASE = {}
            return

        response = requests.get(GOOGLE_APPS_SCRIPT_API_URL, timeout=10)
        response.raise_for_status()
        media_data_from_gas = response.json()
        
        if isinstance(media_data_from_gas, dict):
            MEDIA_DATABASE = media_data_from_gas
            print("Successfully loaded media data from Google Sheet.")
        else:
            print(f"Error: Google Apps Script API did not return expected dictionary format. Response: {response.text[:500]}...")
            MEDIA_DATABASE = {}

    except requests.exceptions.RequestException as e:
        print(f"Network or HTTP error fetching media data from Google Apps Script: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"GAS API error response content: {e.response.text[:500]}...")
        MEDIA_DATABASE = {}
    except json.JSONDecodeError as e:
        print(f"JSON decoding error from Google Apps Script API: {e}. Response: {response.text[:500]}...")
        MEDIA_DATABASE = {}
    except Exception as e:
        print(f"An unexpected error occurred during Google Apps Script data fetch: {e}")
        MEDIA_DATABASE = {}

fetch_media_data_from_google_sheet()

# --- Routes ---

@app.route('/')
def index():
    """Renders the main HTML page for the media viewer."""
    return render_template('index.html')

@app.route('/media/<string:content_id>')
def get_media(content_id):
    """
    API endpoint to retrieve media information based on content_id.
    Returns JSON with media details or an error message if not found.
    """
    media_info = MEDIA_DATABASE.get(content_id)
    if media_info:
        return jsonify(media_info)
    else:
        return jsonify({"error": "Media not found"}), 404

@app.route('/static/<path:filename>')
def serve_static(filename):
    """
    Serves static files (images, videos, CSS, JS) from the 'static' directory.
    """
    return send_from_directory(app.static_folder, filename)

@app.route('/refresh_data', methods=['POST'])
def refresh_data():
    """
    Endpoint to trigger a refresh of the media data from the Google Sheet.
    Accessible via a POST request.
    """
    print("Refresh request received. Reloading media data...")
    fetch_media_data_from_google_sheet()
    return jsonify({"status": "success", "message": "Media data refreshed."})

if __name__ == '__main__':
    app.run(debug=True)