function openModal(boxKey) {
  const displayBoxes = JSON.parse(localStorage.getItem("displayBoxes") || "{}");
  const box = displayBoxes[boxKey] || {};

  // Get existing colors from the stored box or set to defaults
  const headerColor = box.headerColor || getComputedStyle(document.getElementById(`${boxKey}_header`)).backgroundColor || "#ff0000";
  const headerLabelColor = box.headerLabelColor || getComputedStyle(document.getElementById(`${boxKey}_headerLabel`)).color || "#ffffff";
  const propertyLabelColor = box.propertyLabelColor || getComputedStyle(document.getElementById(`${boxKey}_propertyLabel`)).color || "#ffffff";
  const valueLabelColor = box.valueLabelColor || getComputedStyle(document.getElementById(`${boxKey}_valueLabel`)).color || "#ffffff";
  const backgroundColor = box.backgroundColor || getComputedStyle(document.getElementById(`${boxKey}_content`)).backgroundColor || "#262626";

  // Convert RGB to HEX (if needed)
  function rgbToHex(rgb) {
    const match = rgb.match(/\d+/g);
    if (!match) return rgb; // Return original if not in RGB format
    return `#${match.map(x => parseInt(x).toString(16).padStart(2, "0")).join("")}`;
  }

  // Convert colors if they are stored in RGB format
  const headerColorHex = headerColor.startsWith("rgb") ? rgbToHex(headerColor) : headerColor;
  const headerLabelColorHex = headerLabelColor.startsWith("rgb") ? rgbToHex(headerLabelColor) : headerLabelColor;
  const propertyLabelColorHex = propertyLabelColor.startsWith("rgb") ? rgbToHex(propertyLabelColor) : propertyLabelColor;
  const valueLabelColorHex = valueLabelColor.startsWith("rgb") ? rgbToHex(valueLabelColor) : valueLabelColor;
  const backgroundColorHex = backgroundColor.startsWith("rgb") ? rgbToHex(backgroundColor) : backgroundColor;

  // Create a semi-transparent overlay
const overlay = document.createElement("div");
overlay.id = "modal-overlay";
overlay.className = "modal-overlay";
document.body.appendChild(overlay);


  // Create the modal structure
  const modal = document.createElement("div");
  modal.id = "edit-modal";
  modal.className = "modal";

  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-section">
        <label>Header Text:</label>
        <input type="text" id="headerSource" value="${box.headerSource || ''}">
        <input type="color" id="headerLabelColor" value="${headerLabelColorHex}">
      </div>

      <div class="modal-section">
        <label>Header Background Color:</label>
        <input type="color" id="headerColor" value="${headerColorHex}">
      </div>

      <div class="modal-section">
        <label>Property Text:</label>
        <input type="text" id="propertySource" value="${box.propertySource || ''}">
        <input type="color" id="propertyLabelColor" value="${propertyLabelColorHex}">
      </div>

      <div class="modal-section">
        <label>Value Text:</label>
        <input type="text" id="valueSource" value="${box.valueSource || ''}">
        <input type="color" id="valueLabelColor" value="${valueLabelColorHex}">
      </div>

      <div class="modal-section">
        <label>Background Color:</label>
        <input type="color" id="backgroundColor" value="${backgroundColorHex}">
      </div>

      <div class="modal-buttons">
        <button id="saveBox">Save</button>
        <button id="deleteBox">Delete</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Save button functionality
  document.getElementById("saveBox").addEventListener("click", function() {
    displayBoxes[boxKey] = {
      ...box,
      headerSource: document.getElementById("headerSource").value,
      propertySource: document.getElementById("propertySource").value,
      valueSource: document.getElementById("valueSource").value,
      headerColor: document.getElementById("headerColor").value,
      headerLabelColor: document.getElementById("headerLabelColor").value,
      backgroundColor: document.getElementById("backgroundColor").value,
      propertyLabelColor: document.getElementById("propertyLabelColor").value,
      valueLabelColor: document.getElementById("valueLabelColor").value
    };

    localStorage.setItem("displayBoxes", JSON.stringify(displayBoxes));
    updateHTMLBoxAesthetics();
    closeModal();
  });

  // Delete button functionality
  document.getElementById("deleteBox").addEventListener("click", function() {
    delete displayBoxes[boxKey];
    localStorage.setItem("displayBoxes", JSON.stringify(displayBoxes));
    document.getElementById(boxKey)?.remove();
    closeModal();
  });


}


function closeModal() {
  document.getElementById("edit-modal")?.remove();
  document.getElementById("modal-overlay")?.remove();
}


// Open modal on box double-click
document.body.addEventListener("dblclick", function(event) {
  let box = event.target.closest(".box");
  if (box) {
    openModal(box.id);
  }
});



function missingData(){



}