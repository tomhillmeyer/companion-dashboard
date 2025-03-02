function downloadDisplayBoxes() {
    let displayBoxes = JSON.parse(localStorage.getItem("displayBoxes") || "{}");
    const dataStr = JSON.stringify(displayBoxes, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'text/plain' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    let date = new Date().toJSON();
    link.download = 'dashboard_layout_'+date+'.txt';
    link.click();
    URL.revokeObjectURL(url); // Clean up the URL object
}


function loadDisplayBoxes(event) {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        const text = e.target.result;
        try {
            const loadedData = JSON.parse(text);
            deleteAllBoxes();
            localStorage.setItem('displayBoxes', JSON.stringify(loadedData));
            displayBoxes = localStorage.getItem('displayBoxes');
            //alert('DisplayBoxes loaded successfully!');
            loadStoredBoxes();
        } catch (error) {
            alert('Error loading DisplayBoxes. Please ensure the file is correct.');
        }
    };

    reader.readAsText(file);
}

// Function to create and attach the file input for loading
function createFileInput() {
    const input = document.createElement('input');
    input.id = 'file_picker';
    input.type = 'file';
    input.accept = '.txt';
    input.addEventListener('change', loadDisplayBoxes);
    document.body.appendChild(input); // Append to body or a specific container
    input.click(); // Programmatically click to open file dialog
}

function deleteAllBoxes() {
    // Get all elements on the page
    const allElements = document.querySelectorAll('*');

    // Loop through all elements
    allElements.forEach(element => {
        // Check if the element's id matches the pattern "box#" (e.g., box1, box2, box3, ...)
        if (element.id.match(/^box\d+$/)) {
            console.log(`Deleting element with id: ${element.id}`);
            element.remove(); // Remove the element from the DOM
        }
    });

    localStorage.removeItem('displayBoxes');

}