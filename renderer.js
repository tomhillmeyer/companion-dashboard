const path = require('path');
const iconPath = path.join(__dirname, 'icon.png'); // Resolves the absolute path of the image
const imageUrl = `file://${iconPath}`;

document.getElementById('myImage').src = imageUrl;
