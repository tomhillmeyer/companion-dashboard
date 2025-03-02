window.onload = function() {
  loadStoredBoxes();
};

var displayBoxes = {};

function loadStoredBoxes(){
    var storedBoxes = localStorage.getItem('displayBoxes');
            if (storedBoxes) {
                displayBoxes = JSON.parse(storedBoxes);
                for (var boxKey in displayBoxes) {
                    if (displayBoxes.hasOwnProperty(boxKey)) {
                        createBox(boxKey, displayBoxes[boxKey]);
                    }
                }
    }

    var url = localStorage.getItem('url');
            if(url){
                document.getElementById('urlInput').value = url;
            }

    updateDisplayBoxes();
    updateHTMLBoxAesthetics();
}

