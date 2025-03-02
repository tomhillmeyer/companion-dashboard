function updateHTMLBoxes() {
    let displayBoxes = JSON.parse(localStorage.getItem("displayBoxes") || "{}");

    Object.keys(displayBoxes).forEach((boxKey) => {
        const box = displayBoxes[boxKey];

        // Get relevant elements
        const headerLabelElement = document.getElementById(`${boxKey}_headerLabel`);
        const propertyLabelElement = document.getElementById(`${boxKey}_propertyLabel`);
        const valueLabelElement = document.getElementById(`${boxKey}_valueLabel`);

        // Update only the text content of labels
        if (headerLabelElement && box.headerLabel !== undefined) {
            headerLabelElement.textContent = box.headerLabel;
        }
        if (propertyLabelElement && box.propertyLabel !== undefined) {
            propertyLabelElement.textContent = box.propertyLabel;
        }
        if (valueLabelElement && box.valueLabel !== undefined) {
            valueLabelElement.textContent = box.valueLabel;
        }

        // Hide property/value labels if empty
        if (propertyLabelElement) {
            propertyLabelElement.style.display = propertyLabelElement.innerHTML.trim() ? "block" : "none";
        }
        if (valueLabelElement) {
            valueLabelElement.style.display = valueLabelElement.innerHTML.trim() ? "block" : "none";
        }
    });
}

// Runs every second to update only text content
//setInterval(updateHTMLBoxes, 1000);

// ----------------------------------------------
// Runs only when triggered (e.g., when "Save" is clicked in modal)
function updateHTMLBoxAesthetics() {
    let displayBoxes = JSON.parse(localStorage.getItem("displayBoxes") || "{}");

    Object.keys(displayBoxes).forEach((boxKey) => {
        const box = displayBoxes[boxKey];

        // Get relevant elements
        const boxElement = document.getElementById(boxKey);
        const headerElement = document.getElementById(`${boxKey}_header`);
        const contentElement = document.getElementById(`${boxKey}_content`);
        const headerLabelElement = document.getElementById(`${boxKey}_headerLabel`);
        const propertyLabelElement = document.getElementById(`${boxKey}_propertyLabel`);
        const valueLabelElement = document.getElementById(`${boxKey}_valueLabel`);

        // Manage header visibility & adjust content height
        if (headerElement) {
            if (!box.headerSource || box.headerSource.trim() === "") {
                headerElement.style.display = "none";
                contentElement.style.height = "100%"; // Full height when no header
            } else {
                headerElement.style.display = "block";
                contentElement.style.height = "70%"; // Shrink content when header exists
            }
        }

        // Apply background color to both the box and content
        const backgroundColor = box.backgroundColor || "#262626";
        if (boxElement) boxElement.style.backgroundColor = backgroundColor;
        if (contentElement) contentElement.style.backgroundColor = backgroundColor;

        const headerColor = box.headerColor || "red";
        if (headerElement) headerElement.style.backgroundColor = headerColor;

        // Apply text colors
        const fields = [
            { element: headerLabelElement, colorKey: "headerLabelColor" },
            { element: propertyLabelElement, colorKey: "propertyLabelColor" },
            { element: valueLabelElement, colorKey: "valueLabelColor" }
        ];

        fields.forEach(({ element, colorKey }) => {
            if (element && box[colorKey]) {
                element.style.color = box[colorKey];
            }
        });
    });
}
