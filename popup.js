document.addEventListener('DOMContentLoaded', () => {
    // 1. Get current tab info
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        document.getElementById('page-title').textContent = tab.title;
    });

    // 2. Listen for Save
    document.getElementById('save-btn').addEventListener('click', async () => {
        const statusDiv = document.getElementById('status');
        statusDiv.textContent = "Please select your Bookmarks root folder...";
        
        try {
            await handleSave();
            statusDiv.textContent = "Saved successfully!";
            statusDiv.style.color = "green";
            setTimeout(() => window.close(), 1500);
        } catch (err) {
            if (err.name !== 'AbortError') { // Ignore if user hit Cancel
                statusDiv.textContent = "Error: " + err.message;
                statusDiv.style.color = "red";
                console.error(err);
            } else {
                statusDiv.textContent = "Cancelled.";
            }
        }
    });
});

async function handleSave() {
    // --- A. Gather Data ---
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Get Topic (clean up invalid characters just in case)
    let topic = document.getElementById('topic-input').value.trim();
    if (!topic) topic = "General";
    // Remove characters that are bad for folder names like / \ : * ? " < > |
    topic = topic.replace(/[\\/:*?"<>|]/g, "_");

    const note = document.getElementById('user-note').value;
    const timestamp = new Date().toLocaleTimeString();

    // --- B. Prepare Content ---
    let contentToAppend = `\n----------------------------------------\n`;
    contentToAppend += `Date: ${new Date().toLocaleDateString()} ${timestamp}\n`;
    contentToAppend += `Title: ${tab.title}\n`;
    contentToAppend += `URL: ${tab.url}\n`;
    if (note) contentToAppend += `Note: ${note}\n`;

    // --- C. Select ROOT Directory ---
    // The user picks the main folder where all topics live
    const rootHandle = await window.showDirectoryPicker({
        id: 'bookmarks_root', // Helps browser remember last location
        mode: 'readwrite'
    });

    // --- D. Create/Get Topic Folder ---
    // This is the magic: { create: true } makes it if it doesn't exist
    const topicHandle = await rootHandle.getDirectoryHandle(topic, { create: true });

    // --- E. Create/Get Daily File ---
    // We name the file by date: "27th Dec, 2025.txt"
    const dateFileName = formatCustomDate() + ".txt";
    const fileHandle = await topicHandle.getFileHandle(dateFileName, { create: true });

    // --- F. Append Data ---
    const file = await fileHandle.getFile();
    const existingSize = file.size;
    
    // Create a writable stream that keeps existing data
    const writable = await fileHandle.createWritable({ keepExistingData: true });
    
    // Move cursor to the end of the file
    await writable.seek(existingSize);
    
    // Write and close
    await writable.write(contentToAppend);
    await writable.close();
}

function formatCustomDate() {
    const date = new Date();
    const day = date.getDate();
    const year = date.getFullYear();
    const month = date.toLocaleString('default', { month: 'short' });
    
    const suffix = (day) => {
        if (day > 3 && day < 21) return 'th';
        switch (day % 10) {
            case 1:  return "st";
            case 2:  return "nd";
            case 3:  return "rd";
            default: return "th";
        }
    };
    return `${day}${suffix(day)} ${month}, ${year}`;
}