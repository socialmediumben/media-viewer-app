// media_viewer/static/script.js

document.addEventListener('DOMContentLoaded', () => {
    const controlsDiv = document.querySelector('.controls');
    const contentIdInput = document.getElementById('contentIdInput');
    const fetchMediaBtn = document.getElementById('fetchMediaBtn');
    const mediaTitle = document.getElementById('mediaTitle');
    const mediaDisplay = document.getElementById('mediaDisplay');
    const transitionVideo = document.getElementById('transitionVideo'); // Get transition video element

    // NEW: Define the path to your transition video
    // IMPORTANT: This should be the full GCS URL for your Door Animation video.
    const TRANSITION_VIDEO_PATH = "https://storage.googleapis.com/socialmediumben-media-viewer/Door%20Animation.mp4";
    
    // Set the source of the transition video once
    transitionVideo.src = TRANSITION_VIDEO_PATH;

    // --- Function to fetch and display media ---
    async function fetchMedia(contentId) {
        // Clear the input field immediately after search is initiated
        contentIdInput.value = ''; 

        // 1. Play door closing animation
        // We'll use 'true' to indicate the closing phase (where the video makes the screen dark)
        await playTransition(true); 

        // 2. Hide current media and show loading title while behind the "closed door"
        mediaDisplay.innerHTML = ''; 
        mediaTitle.textContent = `Loading media for ID: ${contentId}...`;
        mediaTitle.classList.add('visible'); 

        try {
            const response = await fetch(`/media/${contentId}`);
            const data = await response.json();

            if (response.ok) {
                mediaTitle.textContent = data.title; // Set title text

                let filePath;
                if (data.file_path.startsWith('http://') || data.file_path.startsWith('https://')) {
                    filePath = data.file_path; // It's a full URL from GCS
                } else {
                    filePath = `/static/${data.file_path}`; // It's a relative path from our static folder
                }

                // Create a promise that resolves when the media is fully loaded/ready
                const mediaLoadedPromise = new Promise((resolve, reject) => {
                    if (data.type === 'image') {
                        const img = document.createElement('img');
                        img.src = filePath;
                        img.alt = data.title;
                        img.onload = () => {
                            mediaDisplay.appendChild(img);
                            resolve(); // Image loaded
                        };
                        img.onerror = () => {
                            reject(new Error(`Error loading image: ${data.title}`));
                        };
                        mediaDisplay.appendChild(img);
                    } else if (data.type === 'video') {
                        const video = document.createElement('video');
                        video.src = filePath;
                        video.controls = false;
                        video.autoplay = true;
                        video.loop = true;
                        video.muted = true; // Crucial for autoplay policies
                        video.playsInline = true; 
                        
                        mediaDisplay.appendChild(video);

                        video.load(); // Explicitly load the video

                        // Attempt to play, and handle if it fails
                        video.play().then(() => {
                            console.log("Video autoplayed successfully.");
                            resolve(); // Video loaded and autoplayed
                        }).catch(error => {
                            console.warn("Autoplay was prevented:", error);
                            // Autoplay was blocked, set up manual play fallback
                            video.controls = true; // Show native controls
                            mediaTitle.textContent = `${data.title} (Autoplay blocked, click to play)`;
                            mediaTitle.classList.add('visible'); // Keep title visible
                            
                            video.addEventListener('click', function _listener() {
                                video.play().then(() => {
                                    mediaTitle.classList.remove('visible'); // Hide title after manual play
                                    video.removeEventListener('click', _listener); // Remove listener after first click
                                }).catch(err => {
                                    console.error("Manual play also failed:", err);
                                });
                            });
                            resolve(); // Resolve promise so transition opens, even if play needs click
                        });

                        video.onerror = () => {
                            reject(new Error(`Error loading video: ${data.title}`));
                        };

                    } else {
                        reject(new Error('Unknown media type.'));
                    }
                });

                // 3. Wait for the new media to load before playing the "door opening" animation
                await mediaLoadedPromise;
                mediaTitle.classList.remove('visible'); // Hide loading title if successful

            } else {
                // If fetching data fails, show error and don't play opening animation
                mediaTitle.textContent = data.error || `Error fetching media for ID: ${contentId}.`;
                mediaTitle.classList.add('visible');
                mediaDisplay.innerHTML = '';
            }
        } catch (error) {
            // Network error or media loading error
            console.error('Network error or problem fetching media:', error);
            mediaTitle.textContent = 'Failed to load media (network error or invalid ID).';
            mediaTitle.classList.add('visible');
            mediaDisplay.innerHTML = '';
        }

        // 4. Play door opening animation (only if new media was successfully prepared)
        // Check if there's actually an img or video element appended
        if (mediaDisplay.querySelector('img, video')) {
             await playTransition(false); // false means play opening animation
        } else {
            // If nothing loaded due to error, just hide the transition video if it was shown
            transitionVideo.classList.remove('active');
            transitionVideo.pause();
            transitionVideo.currentTime = 0; // Reset for next use
        }
    }

    // NEW: Function to play transition video
    async function playTransition(isClosing) { // isClosing: true for closing, false for opening
        return new Promise(resolve => {
            if (isClosing) {
                // For closing: ensure video is at start, then play and make visible
                transitionVideo.currentTime = 0; // Start from beginning for closing animation
                transitionVideo.classList.add('active'); // Make overlay visible
                transitionVideo.play();
                transitionVideo.onended = () => {
                    // Resolve when closing animation ends (i.e., screen is dark)
                    resolve(); 
                };
            } else {
                // For opening: This assumes 'Door Animation.mp4' plays a closing sequence
                // and then an opening sequence, or that the 'open' effect is just fading out.
                // If your video is just the 'door closing' animation and ends,
                // you would resolve immediately after hiding.
                
                // If your "Door Animation.mp4" has an opening sequence,
                // you would need to play that specific part, or have a separate "Door Open.mp4".
                // As written, it simply fades out the 'closing' animation overlay.

                transitionVideo.classList.remove('active'); // Make invisible
                transitionVideo.pause(); // Pause it
                transitionVideo.currentTime = 0; // Reset for next use
                resolve(); // Immediately resolve for opening transition (as it's just a fade out)
            }
        });
    }

    // Event listener for the manual input button
    fetchMediaBtn.addEventListener('click', () => {
        const contentId = contentIdInput.value.trim();
        if (contentId) {
            fetchMedia(contentId);
        } else {
            alert('Please enter a Content ID.');
            mediaTitle.classList.remove('visible'); // Hide title if no ID entered
        }
    });

    // Event listener for Enter key in the manual input (for keyboard-like scanners)
    contentIdInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            const contentId = contentIdInput.value.trim();
            if (contentId) {
                fetchMedia(contentId);
            } else {
                alert('Please enter a Content ID.');
                mediaTitle.classList.remove('visible'); // Hide title if no ID entered
            }
        }
    });

    // Function to trigger data refresh on the server
    async function refreshServerData() {
        try {
            console.log("Sending refresh request to server...");
            const response = await fetch('/refresh_data', {
                method: 'POST', // Use POST method
                headers: {
                    'Content-Type': 'application/json' // Indicate JSON body, even if empty
                },
                body: JSON.stringify({}) // Send an empty JSON object as body
            });
            const data = await response.json();
            if (response.ok) {
                console.log("Server refresh response:", data.message);
                mediaTitle.textContent = "Data Refreshed!"; // Optional: show a quick confirmation
                mediaTitle.classList.add('visible');
                setTimeout(() => {
                    mediaTitle.classList.remove('visible');
                }, 1500); // Hide message after 1.5 seconds
            } else {
                console.error("Server refresh failed:", data.message);
                mediaTitle.textContent = `Refresh Error: ${data.message}`;
                mediaTitle.classList.add('visible');
            }
        } catch (error) {
            console.error("Network error during server refresh:", error);
            mediaTitle.textContent = "Network Error: Could not refresh data.";
            mediaTitle.classList.add('visible');
        }
    }

    // Global keydown listener
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Tab') {
            event.preventDefault(); // Prevent default tab behavior (e.g., focusing next element)
            controlsDiv.classList.toggle('visible'); // Toggle the 'visible' class
            if (controlsDiv.classList.contains('visible')) {
                contentIdInput.focus(); // If controls become visible, focus the input
            }
        } else if (event.key === '(') { // Hotkey for Full Screen
            event.preventDefault(); // Prevent default behavior of '('
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                    console.warn(`Error attempting to enable full-screen mode: ${err.message} (Perhaps not allowed by browser security policy?)`);
                });
            } else {
                document.exitFullscreen();
            }
        } else if (event.key === ')') { // Hotkey for Data Refresh
            event.preventDefault(); // Prevent default behavior of ')'
            refreshServerData(); // Trigger data refresh
        }
    });

    // Initial state: Hide title on page load
    mediaTitle.classList.remove('visible');
    // Initial state: Hide controls on page load
    controlsDiv.classList.remove('visible');
});