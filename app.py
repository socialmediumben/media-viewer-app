# media_viewer/app.py
from flask import Flask, render_template, jsonify, send_from_directory

app = Flask(__name__)

# --- Our "Database" (a Python dictionary for demonstration) ---
# This remains online and can be updated from anywhere.
MEDIA_DATABASE = {
    "image001": {
        "title": "Sunset Over the Ocean",
        "type": "image",
        "file_path": "images/your_image_1.jpg"
    },
    "image002": {
        "title": "Mountain View",
        "type": "image",
        "file_path": "images/your_image_2.png"
    },
    "video001": {
        "title": "Forest Stream",
        "type": "video",
        "file_path": "videos/your_video_1.mp4"
    },
    "video002": {
        "title": "City Lights",
        "type": "video",
        "file_path": "videos/your_video_2.webm"
    }
}

# --- Configuration for local file path ---
# This path points to your mounted thumb drive on Ubuntu.
LOCAL_MEDIA_PATH = '/media/socialmedium/MediaServer'

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

@app.route('/local_media/<path:filename>')
def serve_local_media(filename):
    """
    Serves static media files (images, videos) from the thumb drive.
    The `filename` here will be the path relative to LOCAL_MEDIA_PATH.
    """
    return send_from_directory(LOCAL_MEDIA_PATH, filename)

if __name__ == '__main__':
    # Run the Flask development server
    app.run(debug=True)
