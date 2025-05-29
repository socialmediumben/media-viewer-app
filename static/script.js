// media_viewer/static/script.js

document.addEventListener('DOMContentLoaded', () => {
    const controlsDiv = document.querySelector('.controls');
    const contentIdInput = document.getElementById('contentIdInput');
    const fetchMediaBtn = document.getElementById('fetchMediaBtn');
    const mediaTitle = document.getElementById('mediaTitle');
    const mediaDisplay = document.getElementById('mediaDisplay');
    const transitionVideo = document.getElementById('transitionVideo');

    // Variables to store fetched transition video paths
    let doorCloseVideoUrl = "";
    let doorOpenVideoUrl = "";

    // Function to fetch a specific media item's data (for transition videos)
    async function getMediaData(contentId) {
        try {
            const response = await fetch(`/media/${contentId}`);
            const data = await response.json();
            if (response.ok && data.file_path) {
                return data.file_path;
            } else {
                console.error(`Failed to get media data for ID: ${contentId}`, data.error);
                return null;
            }
        } catch (error) {
            console.error(`Network error fetching media data for ID: ${contentId}:`, error);
            return null;
        }
    }

    // Fetch transition video paths on page load
    (async () => {
        doorCloseVideoUrl = await getMediaData("Door Close"); // Use the ID from your Google Sheet
        doorOpenVideoUrl = await getMediaData("Door Open");   // Use the ID from your Google Sheet

        if (!doorCloseVideoUrl || !doorOpenVideoUrl) {
            console.error("WARNING: Could not fetch one or both transition video URLs from the database. Transitions may not work.");
        }
    })();

    // --- Function to play transition video ---
    async function playTransition(videoPath) {
        return new Promise(resolve => {
            if (!videoPath) {
                console.warn("Transition video path is missing. Skipping transition.");
                resolve();
                return;
            }
            transitionVideo.src = videoPath;
            transitionVideo.currentTime = 0;
            transitionVideo.classList.add('active'); // Make overlay visible
            
            transitionVideo.onended = () => {
                transitionVideo.onended = null;
                resolve();
            };

            transitionVideo.play().catch(error => {
                console.warn(`Transition video autoplay blocked for ${videoPath}:`, error);
                // If autoplay is blocked, resolve immediately to not hang the app
                transitionVideo.classList.remove('active'); // Hide it immediately if it can't play
                transitionVideo.onended = null;
                resolve();
            });
        });
    }

    // --- Function to fetch and display media ---
    async function fetchMedia(contentId) {
        // Clear input field immediately
        contentIdInput.value = ''; 

        // Hide title (if visible) before any transition or loading message
        mediaTitle.classList.remove('visible'); 

        // 1. Play door closing animation OVER current media
        if (doorCloseVideoUrl) {
            await playTransition(doorCloseVideoUrl); // Wait for Door Close to finish and cover screen
        } else {
            console.warn("Door Close video URL not available. Skipping closing transition.");
        }

        // 2. NOW (screen should be fully covered by Door Close video):
        //    Clear old media, show loading title, and load new media
        mediaDisplay.innerHTML = ''; // Clear the old media
        mediaTitle.textContent = `Loading media for ID: ${contentId}...`; // Show loading title
        mediaTitle.classList.add('visible'); // Make loading title visible

        try {
            const response = await fetch(`/media/${contentId}`);
            const data = await response.json();

            if (response.ok) {
                // Determine file path for the new media
                let filePath;
                if (data.file_path.startsWith('http://') || data.file_path.startsWith('https://')) {
                    filePath = data.file_path;
                } else {
                    filePath = `/static/${data.file_path}`;
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
                        video.muted = true;
                        video.playsInline = true; 
                        
                        mediaDisplay.appendChild(video);

                        video.load(); 

                        video.play().then(() => {
                            console.log("Video autoplayed successfully.");
                            resolve();
                        }).catch(error => {
                            console.warn("Autoplay was prevented:", error);
                            video.controls = true;
                            mediaTitle.textContent = `${data.title} (Autoplay blocked, click to play)`; // Update title
                            mediaTitle.classList.add('visible'); // Keep title visible
                            video.addEventListener('click', function _listener() {
                                video.play().then(() => {
                                    mediaTitle.classList.remove('visible');
                                    video.removeEventListener('click', _listener);
                                }).catch(err => {
                                    console.error("Manual play also failed:", err);
                                });
                            });
                            resolve(); // Resolve promise so transition can continue
                        });

                        video.onerror = () => {
                            reject(new Error(`Error loading video: ${data.title}`));
                        };

                    } else {
                        reject(new Error('Unknown media type.'));
                    }
                });

                // Wait for the new media to finish loading (while still covered by Door Close video)
                await mediaLoadedPromise;
                mediaTitle.classList.remove('visible'); // Hide loading title if successful

            } else {
                // If fetching data fails, show error and don't play opening animation
                mediaTitle.textContent = data.error || `Error fetching media for ID: ${contentId}.`;
                mediaTitle.classList.add('visible');
                mediaDisplay.innerHTML = ''; // Ensure display is empty on error
            }
        } catch (error) {
            console.error('Network error or problem fetching media:', error);
            mediaTitle.textContent = 'Failed to load media (network error or invalid ID).';
            mediaTitle.classList.add('visible');
            mediaDisplay.innerHTML = ''; // Ensure display is empty on error
        }

        // 3. Play door opening animation
        // This will play OVER the new media, revealing it as the door opens.
        if (mediaDisplay.querySelector('img, video') && doorOpenVideoUrl) {
             // Start playing Door Open. The new media is already in mediaDisplay (but under the transition video).
             await playTransition(doorOpenVideoUrl); // Wait for Door Open to finish
             
             // After Door Open plays, hide the transition video overlay
             transitionVideo.classList.remove('active');
             transitionVideo.pause();
             transitionVideo.currentTime = 0;
        } else {
            console.warn("Door Open transition skipped due to no media loaded or URL missing.");
            // Ensure transition video is hidden if it was left active
            transitionVideo.classList.remove('active');
            transitionVideo.pause();
            transitionVideo.currentTime = 0;
        }
    }

    // Event listener for the manual input button
    fetchMediaBtn.addEventListener('click', () => {
        const contentId = contentIdInput.value.trim();
        if (contentId) {
            fetchMedia(contentId);
        } else {
            alert('Please enter a Content ID.');
            mediaTitle.classList.remove('visible');
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
                mediaTitle.classList.remove('visible');
            }
        }
    });

    // Function to trigger data refresh on the server
    async function refreshServerData() {
        try {
            console.log("Sending refresh request to server...");
            const response = await fetch('/refresh_data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });
            const data = await response.json();
            if (response.ok) {
                console.log("Server refresh response:", data.message);
                mediaTitle.textContent = "Data Refreshed!";
                mediaTitle.classList.add('visible');
                setTimeout(() => {
                    mediaTitle.classList.remove('visible');
                }, 1500);
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
            event.preventDefault();
            controlsDiv.classList.toggle('visible');
            if (controlsDiv.classList.contains('visible')) {
                contentIdInput.focus();
            }
        } else if (event.key === '(') { // Hotkey for Full Screen
            event.preventDefault();
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                    console.warn(`Error attempting to enable full-screen mode: ${err.message} (Perhaps not allowed by browser security policy?)`);
                });
            } else {
                document.exitFullscreen();
            }
        } else if (event.key === ')') { // Hotkey for Data Refresh
            event.preventDefault();
            refreshServerData();
        }
    });

    // Initial state: Hide title on page load
    mediaTitle.classList.remove('visible');
    // Initial state: Hide controls on page load
    controlsDiv.classList.remove('visible');
});