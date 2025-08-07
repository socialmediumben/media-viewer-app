# media_viewer/app.py
from flask import Flask, render_template, jsonify, send_from_directory
import os
import gspread
from google.oauth2.service_account import Credentials

app = Flask(__name__)

# --- Google Sheets Configuration ---
# The ID from your Google Sheet URL
SPREADSHEET_ID = '1emI1-oi7g0SZCr0oYdUViDOs7tjSuaKQ1IW0GupD4CM' 
# The name of the worksheet tab to read from
WORKSHEET_NAME = 'Sheet1' 
# The name of the JSON key file you downloaded from Google Cloud
SERVICE_ACCOUNT_FILE = 'credentials.json'

# This will hold our media data, populated from the Google Sheet
MEDIA_DATABASE = {} 

# --- Configuration for local file path ---
# This path points to your mounted thumb drive on Ubuntu.
LOCAL_MEDIA_PATH = '/media/socialmedium/MediaServer'

# Function to load data from the Google Sheet
def load_media_database_from_sheet():
    global MEDIA_DATABASE
    try:
        # Authenticate with the Google Sheets API using the JSON key file
        scope = ['https://www.googleapis.com/auth/spreadsheets.readonly']
        creds = Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=scope)
        client = gspread.authorize(creds)
        
        # Open the specified spreadsheet and worksheet
        sheet = client.open_by_key(SPREADSHEET_ID).worksheet(WORKSHEET_NAME)
        
        # Get all data from the sheet as a list of dictionaries
        list_of_dicts = sheet.get_all_records()
        
        # Populate the global MEDIA_DATABASE dictionary
        new_database = {}
        for row in list_of_dicts:
            content_id = str(row['content_id']).strip()
            if content_id: # Ensure content_id is not empty
                new_database[content_id] = {
                    'title': str(row['title']).strip(),
                    'type': str(row['type']).strip().lower(),
                    'file_path': str(row['file_path']).strip()
                }
        
        MEDIA_DATABASE = new_database
        print("Media database loaded successfully from Google Sheet.")
        
    except Exception as e:
        print(f"Error loading database from Google Sheet: {e}")
        MEDIA_DATABASE = {}


# --- Routes ---
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/media/<string:content_id>')
def get_media(content_id):
    media_info = MEDIA_DATABASE.get(content_id)
    if media_info:
        return jsonify(media_info)
    else:
        return jsonify({"error": "Media not found"}), 404

@app.route('/local_media/<path:filename>')
def serve_local_media(filename):
    return send_from_directory(LOCAL_MEDIA_PATH, filename)


if __name__ == '__main__':
    # Load the database from the Google Sheet before starting the app
    load_media_database_from_sheet()
    app.run(debug=True)
