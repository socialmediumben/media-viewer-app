// media_viewer/static/script.js

document.addEventListener('DOMContentLoaded', () => {
    const controlsDiv = document.querySelector('.controls');
    const contentIdInput = document.getElementById('contentIdInput');
    const fetchMediaBtn = document.getElementById('fetchMediaBtn');
    const mediaTitle = document.getElementById('mediaTitle');
    const mediaDisplay = document.getElementById('mediaDisplay');

    // Function to fetch and display media
    async function fetchMedia(contentId) {
        // Show title during loading
        mediaTitle.textContent = `Loading media for ID: ${contentId}...`;
        mediaTitle.classList.add('visible'); // Make title visible
        mediaDisplay.innerHTML = ''; // Clear previous media

        // Clear the input field immediately after search is initiated
        contentIdInput.value = ''; 

        try {
            const response = await fetch(`/media/${contentId}`);
            const data = await response.json();

            if (response.ok) {
                mediaTitle.textContent = data.title; // Set title text

                const filePath = `/static/${data.file_path}`;

                if (data.type === 'image') {
                    const img = document.createElement('img');
                    img.src = filePath;
                    img.alt = data.title;
                    img.onload = () => { // Hide title after image loads
                        mediaTitle.classList.remove('visible');
                    };
                    img.onerror = () => { // Keep title visible on image load error
                        mediaTitle.textContent = `Error loading image: ${data.title}`;
                        mediaTitle.classList.add('visible');
                    };
                    mediaDisplay.appendChild(img);
                } else if (data.type === 'video') {
                    const video = document.createElement('video');
                    video.src = filePath;
                    video.controls = false;
                    video.autoplay = true;
                    video.loop = true;
                    video.muted = true; // Crucial for autoplay
                    video.playsInline = true;
                    mediaDisplay.appendChild(video);

                    video.onloadeddata = () => { // Hide title after video data is loaded
                         mediaTitle.classList.remove('visible');
                    };
                    video.onerror = () => { // Keep title visible on video load error
                        mediaTitle.textContent = `Error loading video: ${data.title}`;
                        mediaTitle.classList.add('visible');
                    };

                    video.play().catch(error => {
                        console.warn("Autoplay was prevented:", error);
                        video.controls = true;
                        mediaTitle.textContent = `${data.title} (Click play)`;
                        mediaTitle.classList.add('visible'); // Ensure title visible if autoplay fails
                    });
                } else {
                    mediaTitle.textContent = 'Unknown media type.';
                    mediaDisplay.innerHTML = '<p>Unsupported media type.</p>';
                    mediaTitle.classList.add('visible'); // Keep title visible for unsupported types
                }

            } else {
                mediaTitle.textContent = data.error || `Error fetching media for ID: ${contentId}.`;
                mediaDisplay.innerHTML = '';
                mediaTitle.classList.add('visible'); // Keep title visible on fetch error
            }
        } catch (error) {
            console.error('Network error or problem fetching media:', error);
            mediaTitle.textContent = 'Failed to load media (network error or invalid ID).';
            mediaDisplay.innerHTML = '';
            mediaTitle.classList.add('visible'); // Keep title visible on network error
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
                // If not currently in full screen, request full screen for the entire document body
                document.documentElement.requestFullscreen().catch(err => {
                    console.warn(`Error attempting to enable full-screen mode: ${err.message} (Perhaps not allowed by browser security policy?)`);
                });
            } else {
                // If currently in full screen, exit full screen
                document.exitFullscreen();
            }
        } else if (event.key === ')') { // NEW: Hotkey for Data Refresh
            event.preventDefault(); // Prevent default behavior of ')'
            refreshServerData(); // Trigger data refresh
        }
    });

    // Initial state: Hide title on page load
    mediaTitle.classList.remove('visible');
    // Initial state: Hide controls on page load
    controlsDiv.classList.remove('visible');
});