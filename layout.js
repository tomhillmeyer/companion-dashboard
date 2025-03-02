window.addEventListener('mouseup', function(event){
	roundWidths();
	//console.log("MOUSE UP!");

})

function dragElement(elmnt, boxKey) {
  var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  document.getElementById(elmnt.id + "_mover").onmousedown = dragMouseDown;
  //document.getElementById(elmnt.id + "_mover").onmousedown = dragMouseDown; 


  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    // get the mouse cursor position at startup:
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // call a function whenever the cursor moves:
    document.onmousemove = elementDrag;
    
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    // calculate the new cursor position:
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // set the element's new position:
    
    var top = elmnt.offsetTop - pos2;
    var left = elmnt.offsetLeft - pos1
    
    elmnt.style.top = top + "px";
    elmnt.style.left = left + "px";
    
    //zLevel += 1;
    //elmnt.style.zIndex = zLevel;
    
  }

  function closeDragElement(e) {
  	e = e || window.event;
    e.preventDefault();
    // calculate the new cursor position:
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // set the element's new position:
    
    var top = elmnt.offsetTop - pos2;
    var left = elmnt.offsetLeft - pos1
    
    elmnt.style.top = Math.floor(top / 10 + .5)*10 + "px";
    elmnt.style.left = Math.floor(left / 10 + .5)*10 + "px";
  		
    // stop moving when mouse button is released:
    document.onmouseup = null;
    document.onmousemove = null;

    let displayBoxes = JSON.parse(localStorage.getItem("displayBoxes") || "{}");
    displayBoxes[boxKey] = {
        top: top,
        left: left,
        width: displayBoxes[boxKey]["width"],
        height: displayBoxes[boxKey]["height"],
        headerColor: displayBoxes[boxKey]["headerColor"],
        headerSource: displayBoxes[boxKey]["headerSource"],
        headerLabel: displayBoxes[boxKey]["headerLabel"],
        headerLabelColor: displayBoxes[boxKey]["headerLabelColor"],
        propertySource: displayBoxes[boxKey]["propertySource"],
        propertyLabel: displayBoxes[boxKey]["propertyLabel"],
        propertyLabelColor: displayBoxes[boxKey]["propertyLabelColor"],
        valueSource: displayBoxes[boxKey]["valueSource"],
        valueLabel: displayBoxes[boxKey]["valueLabel"],
        valueLabelColor: displayBoxes[boxKey]["valueLabelColor"],
        backgroundColor: displayBoxes[boxKey]["backgroundColor"]
    };

    localStorage.setItem('displayBoxes', JSON.stringify(displayBoxes));
    
  }
}

function roundWidths(){
	const boxes = document.querySelectorAll(".box");
    //console.log(boxes.length);
    
    var displayBoxes = JSON.parse(localStorage.getItem('displayBoxes'));    	
    
    for (var boxKey in displayBoxes){
    
		x = boxKey
		y = document.getElementById(x)
		//console.log(x);
		
		//console.log("BEFORE WIDTH: " + y.style.width);
		//console.log("BEFORE HEIGHT: " + y.style.width);
		
		var width = Math.floor(parseInt(y.style.width) / 10 + .5) * 10;
		var height = Math.floor(parseInt(y.style.height) / 10 + .5) * 10;
		
		//console.log("NEW WIDTH: " + y.style.width);
		//console.log("NEW HEIGHT: " + y.style.width);
		
		y.style.width = width + "px";
		y.style.height = height + "px";
	

    displayBoxes[boxKey] = {
        top: y.style.top,
        left: y.style.left,
        width: y.style.width,
        height: y.style.height,
        headerColor: displayBoxes[boxKey]["headerColor"],
        headerSource: displayBoxes[boxKey]["headerSource"],
        headerLabel: displayBoxes[boxKey]["headerLabel"],
        headerLabelColor: displayBoxes[boxKey]["headerLabelColor"],
        propertySource: displayBoxes[boxKey]["propertySource"],
        propertyLabel: displayBoxes[boxKey]["propertyLabel"],
        propertyLabelColor: displayBoxes[boxKey]["propertyLabelColor"],
        valueSource: displayBoxes[boxKey]["valueSource"],
        valueLabel: displayBoxes[boxKey]["valueLabel"],
        valueLabelColor: displayBoxes[boxKey]["valueLabelColor"],
        backgroundColor: displayBoxes[boxKey]["backgroundColor"]
    };

   		 // Save the updated displayBoxes to local storage
  		localStorage.setItem('displayBoxes', JSON.stringify(displayBoxes));
  		
  		//ResizeFont
  		
  		const container = document.getElementById(x + "_propertyLabel");
    	const parent = y;
    	const parentWidth = parent.clientWidth - 30;
    	const parentHeight = parent.clientHeight - 45;

    	let fontSize = 50; // Start with a large font size
    	container.style.fontSize = fontSize + 'px';

    	while (container.scrollWidth > parentWidth || container.scrollHeight > parentHeight) {
       		fontSize -= 1;
        	container.style.fontSize = fontSize + 'px';
   		 }
    		
    }

}


/*
function savePosition(boxKey){

  displayBoxes[boxKey] = {
        top: "50px",
        left: "50px",
        width: "300px",
        height: "150px",
        headerSource: "Timer",
        headerLabel: "timer",
        propertySource: "Current Time",
        propertyLabel: "Current Time",
        valueSource: "$(internal:time_hms)",
        valueLabel: "00:00:00"
    };

    localStorage.setItem('displayBoxes', JSON.stringify(displayBoxes));

}*/