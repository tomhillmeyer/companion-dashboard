function updateDisplayBoxes() {
    let displayBoxes = JSON.parse(localStorage.getItem("displayBoxes") || "{}");
    var url = localStorage.getItem("url");

    const fields = [
        { source: "headerSource", label: "headerLabel", colorKey: "headerLabelColor" },
        { source: "propertySource", label: "propertyLabel", colorKey: "propertyLabelColor" },
        { source: "valueSource", label: "valueLabel", colorKey: "valueLabelColor" }
    ];

    Object.keys(displayBoxes).forEach((boxKey) => {
        const box = displayBoxes[boxKey];

        fields.forEach(({ source, label, colorKey }) => {
            if (typeof box[source] !== "string") return;

            const variableRegex = /\$\(([^)]+)\)/g;
            let updatedLabel = box[source];

            let matches = box[source].match(variableRegex);

            if (!matches || !url) {
                // No variables OR no URL → Replace variables with empty string and update label
                updatedLabel = updatedLabel.replace(variableRegex, "");
                box[label] = updatedLabel;
            } else {
                // Process each variable asynchronously if fetching is allowed
                let fetchPromises = matches.map((match) => {
                    const varName = match.slice(2, -1).replace(":", "/");
                    const fetchUrl = `http://${url}/api/variable/${varName}/value`;

                    //console.log(`Fetching variable: ${match} from ${fetchUrl}`);

                    return fetch(fetchUrl)
                        .then(response => response.text())
                        .then(value => {
                            //console.log(`Fetched value for ${match}: ${value.trim()}`);
                            updatedLabel = updatedLabel.replace(match, value.trim());
                            document.getElementById("urlInput").style.backgroundColor = "lightgreen";
                        })
                        .catch(error => {
                            console.error(`Error fetching ${match}:`, error);
                            document.getElementById("urlInput").style.backgroundColor = "lightcoral";
                        });
                });

                // After all fetches complete, update localStorage
                Promise.all(fetchPromises).then(() => {
                    //console.log(`Updated ${label} for box ${boxKey}: ${updatedLabel}`);
                    box[label] = updatedLabel;
                    localStorage.setItem("displayBoxes", JSON.stringify(displayBoxes));
                });
            }

            // Always update colors, even if no fetching happens
            if (box[colorKey]) document.getElementById(`${boxKey}_${label}`).style.color = box[colorKey];

        });

        // Apply background color to both `box#` and `box#_content`
        if (box.backgroundColor) {
            document.getElementById(boxKey).style.backgroundColor = box.backgroundColor;
            document.getElementById(`${boxKey}_content`).style.backgroundColor = box.backgroundColor;
        }
    });

    // Store updated displayBoxes in localStorage
    localStorage.setItem("displayBoxes", JSON.stringify(displayBoxes));
}

// Run the function every second
setInterval(() => {
    updateHTMLBoxes();     // Updates text content
    updateDisplayBoxes();  // Fetches new data (if URL exists)
}, 1000);








function cleanAndSaveInput() {
    const inputElement = document.getElementById('urlInput');
    let inputValue = inputElement.value.trim(); // Remove leading/trailing spaces

    // Regex to match and clean the input
    const regex = /^(https?:\/\/)?([a-zA-Z0-9.-]+)(?::(\d+))?(\/)?$/;
    const match = inputValue.match(regex);

    if (match) {
        const address = match[2]; // The address (e.g., 127.0.0.1 or example.com)
        const port = match[3]; // The port, if specified (e.g., 8888)
        const cleanedURL = port ? `${address}:${port}` : `${address}`;

        inputElement.value = cleanedURL;
        localStorage.setItem("url", cleanedURL);

        // Test connection by fetching $(internal:time_unix)
        const testURL = `http://${cleanedURL}/api/variable/internal/time_unix/value`;

        fetch(testURL)
            .then(response => response.text())
            .then(() => {
                inputElement.style.backgroundColor = "lightgreen"; // Connection successful
            })
            .catch(() => {
                inputElement.style.backgroundColor = "lightcoral"; // Connection failed
            });

    } else {
        alert("Invalid address format. Please enter a valid address.");
    }
}

// Event listener for the "Save" button
document.getElementById('saveURL').addEventListener('click', cleanAndSaveInput);

