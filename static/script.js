// media_viewer/static/script.js

document.addEventListener('DOMContentLoaded', () => {
    const controlsDiv = document.querySelector('.controls');
    const contentIdInput = document.getElementById('contentIdInput');
    const fetchMediaBtn = document.getElementById('fetchMediaBtn');
    const mediaTitle = document.getElementById('mediaTitle');
    const mediaDisplay = document.getElementById('mediaDisplay');
    const transitionVideo = document.getElementById('transitionVideo');

    // NEW: Variables to store fetched transition video paths
    let doorCloseVideoUrl = "";
    let doorOpenVideoUrl = "";

    // NEW: Function to fetch a specific media item's data (for transition videos)
    async function getMediaData(contentId) {
        try {
            const response = await fetch(`/media/${contentId}`);
            const data = await response.json();
            if (response.ok && data.file_path) {
                return data.file_path; // Return the file_path directly
            } else {
                console.error(`Failed to get media data for ID: ${contentId}`, data.error);
                return null;
            }
        } catch (error) {
            console.error(`Network error fetching media data for ID: ${contentId}:`, error);
            return null;
        }
    }

    // NEW: Fetch transition video paths on page load
    // Using a self-executing async function to do this once
    (async () => {
        doorCloseVideoUrl = await getMediaData("Door Close"); // Use the ID from your Google Sheet
        doorOpenVideoUrl = await getMediaData("Door Open");   // Use the ID from your Google Sheet

        if (!doorCloseVideoUrl || !doorOpenVideoUrl) {
            console.error("WARNING: Could not fetch one or both transition video URLs from the database.");
            // You might want to display a message to the user or use fallback logic here
        }
    })();

    // --- Function to play transition video ---
    async function playTransition(videoPath) {
        return new Promise(resolve => {
            if (!videoPath) {
                console.warn("Transition video path is missing. Skipping transition.");
                resolve(); // Resolve immediately if path is missing
                return;
            }
            transitionVideo.src = videoPath; // Set the source for the specific transition video
            transitionVideo.currentTime = 0; // Ensure it starts from the beginning
            transitionVideo.classList.add('active'); // Make overlay visible
            
            // Set up event listener to resolve the promise when video ends
            transitionVideo.onended = () => {
                transitionVideo.onended = null; // Remove listener to prevent multiple calls
                resolve(); 
            };

            // Attempt to play, handling cases where it might be blocked
            transitionVideo.play().catch(error => {
                console.warn(`Transition video autoplay blocked for ${videoPath}:`, error);
                // If autoplay is blocked, resolve immediately so the app doesn't hang.
                // The transition won't be smooth, but the app will continue.
                transitionVideo.classList.remove('active'); // Hide it if it can't play
                transitionVideo.onended = null;
                resolve(); 
            });
        });
    }

    // --- Function to fetch and display media ---
    async function fetchMedia(contentId) {
        // Clear the input field immediately after search is initiated
        contentIdInput.value = ''; 

        // 1. Play door closing animation (covers the current media)
        // This will make the the screen dark. We wait for it to complete.
        if (doorCloseVideoUrl) { // Only play if URL is available
            await playTransition(doorCloseVideoUrl); 
        } else {
            console.warn("Door Close video URL not available. Skipping closing transition.");
        }

        // 2. ONLY NOW clear previous media, as it's hidden behind the closed door
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

                // Create a promise that resolves when the new media is fully loaded/ready
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

                // 3. Wait for the new media to load (while doors are closed)
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
            mediaDisplay.innerHTML = ''; // Clear media display on network error
            mediaTitle.classList.add('visible'); // Keep title visible on network error
        }

        // 4. Play door opening animation (only if new media was successfully prepared)
        if (mediaDisplay.querySelector('img, video') && doorOpenVideoUrl) { // Only play if new media and URL available
             await playTransition(doorOpenVideoUrl); // Play the specific Door Open video
             // After Door Open plays, hide the transition video overlay
             transitionVideo.classList.remove('active');
             transitionVideo.pause();
             transitionVideo.currentTime = 0; // Reset for next use
        } else if (!doorOpenVideoUrl) {
            console.warn("Door Open video URL not available. Skipping opening transition.");
            // Ensure transition video is hidden if it was somehow left active
            transitionVideo.classList.remove('active');
            transitionVideo.pause();
            transitionVideo.currentTime = 0;
        } else {
            // If nothing loaded due to error, ensure transition video is hidden
            transitionVideo.classList.remove('active');
            transitionVideo.pause();
            transitionVideo.currentTime = 0; // Reset for next use
        }
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