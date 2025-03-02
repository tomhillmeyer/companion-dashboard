document.getElementById("create-button").addEventListener("click", newBox);
var boxKey = 0;

function newBox() {
    var maxNumber = 0;

    let displayBoxes = JSON.parse(localStorage.getItem("displayBoxes") || "{}");

    for (var boxKey in displayBoxes) {
        if (displayBoxes.hasOwnProperty(boxKey)) {
            var boxNumber = parseInt(boxKey.replace("box", ""), 10);
            if (boxNumber > maxNumber) {
                maxNumber = boxNumber;
            }
        }
    }

    boxKey = "box" + (maxNumber + 1);

    // Set default position, size, and colors
    displayBoxes[boxKey] = {
        top: "50px",
        left: "50px",
        width: "500px",
        height: "100px",
        headerSource: "Timer",
        headerLabel: "timer",
        propertySource: "Current Time",
        propertyLabel: "Current Time",
        valueSource: "$(internal:time_hms)",
        valueLabel: "00:00:00",
        headerColor: "#ff0000",        // Default RED header
        headerLabelColor: "#ffffff",   // Default WHITE text
        propertyLabelColor: "#ffffff", // Default WHITE text
        valueLabelColor: "#ffffff",    // Default WHITE text
        backgroundColor: "#262626"     // Default DARK GRAY background
    };

    // Save to local storage
    localStorage.setItem("displayBoxes", JSON.stringify(displayBoxes));

    //console.log(displayBoxes); // Debugging

    createBox(boxKey, displayBoxes[boxKey]);

    // Open modal immediately after creation
    openModal(boxKey);
}


function createBox(boxKey, boxData) {
	var displayBoxes = JSON.parse(localStorage.getItem('displayBoxes'));    	

    var boxContainer = document.createElement("div");
    boxContainer.id = boxKey;
    boxContainer.className = "box";

    // Apply style parameters from boxData
    boxContainer.style.position = "absolute";
    boxContainer.style.top = boxData.top;
    boxContainer.style.left = boxData.left;
    boxContainer.style.width = boxData.width;
    boxContainer.style.height = boxData.height;
    boxContainer.style.resize = "both";
    boxContainer.style.overflow = "auto";

    var moverDiv = document.createElement("div");
    moverDiv.id = boxKey + "_mover";
    moverDiv.className = "mover";

    var headerDiv = document.createElement("div");
    headerDiv.id = boxKey + "_header";
    headerDiv.className = "header";
    headerDiv.style.height = "30%";

    var headerLabel = document.createElement("h3");
    headerLabel.id = boxKey + "_headerLabel";
    //console.log(boxData.headerLabel);
    headerLabel.textContent = boxData.headerLabel;
    headerDiv.appendChild(headerLabel);

    var contentDiv = document.createElement("div");
    contentDiv.id = boxKey + "_content";
    contentDiv.className = "content";
    contentDiv.style.height = "70%";

    var propertyLabel = document.createElement("h2");
    propertyLabel.id = boxKey + "_propertyLabel";
    //console.log(boxData.propertyLabel);
    propertyLabel.textContent = boxData.propertyLabel;
    contentDiv.appendChild(propertyLabel);

    var valueLabel = document.createElement("h1");
    valueLabel.id = boxKey + "_valueLabel";
    //console.log(boxData.valueLabel);
    valueLabel.textContent = boxData.valueLabel;
    contentDiv.appendChild(valueLabel);

    moverDiv.appendChild(headerDiv);
    moverDiv.appendChild(contentDiv);
    boxContainer.appendChild(moverDiv);

    document.body.appendChild(boxContainer);
    
    dragElement(boxContainer,boxKey);
    
    //updateBoxContent(boxKey, boxData.source);
    
    /* Open modal on double click instead of delete
    boxContainer.addEventListener("dblclick", function () {
        showBoxModal(boxKey);
    });*/
}

function removeBox(boxKey) {
    //console.log("Double click!");

    // Remove the box from the DOM
    var boxElement = document.getElementById(boxKey);
    if (boxElement) {
        boxElement.remove();
    }

    // Remove the box from the displayBoxes object
    delete displayBoxes[boxKey];

    // Update local storage with the remaining boxes
    localStorage.setItem('displayBoxes', JSON.stringify(displayBoxes));

    // Refresh the page
    // location.reload();
}