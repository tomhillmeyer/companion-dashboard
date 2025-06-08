<img src="https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/refs/heads/main/assets/dashboard.png" width="200"></img>
# Companion Dashboard

This is an application for displaying variables from Bitfocus Companion.

## Example Layouts
![App Screenshot](https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/refs/heads/main/screenshots/sample-layout.png)



## How to use

![App Screenshot](https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/refs/heads/main/screenshots/settings-menu.png)

- The settings pane opens from the left side of the screen. Open it with the arrow / carrot in the bottom left of the viewport
- Input the address:port of your Companion instance and click "Set Connection." The outline around the address will turn green if it's connected to Companion.
- Click "New Box" to add a new box to the canvas.
- "Clear All Boxes" clears all of the boxes off of the canvas.
- "Download Config" and "Restore Config" allow you to download box details, layout, and Companion connection into a file to be restored from later. Restoring a configuration replaces whatever configuration is in place.

![App Screenshot](https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/refs/heads/main/screenshots/resize-handles.png)

- Clicking a box once selects it and allows you to resize and move it on the canvas.

![App Screenshot](https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/refs/heads/main/screenshots/box-settings-modal.png)

- Double clicking a box launches the settings window for that box.
- All of the color pickers have a "Variable or HEX" text field. That text field takes priority.

## Tips & Tricks
- Text fields automatically concatenate, so you can include multiple variables and strings
- Option + Click a box and it will duplicate
- Select a box and hit "backspace" or "delete" to delete



## Roadmap

- Grouping boxes together, both to move/resize them as well as more options to visually group boxes together
- Connect to multiple Companion instances at the same time
- Clean up UI and Menus, evolve the UI based on how people use it
- Use Companion variables to set box size, position, and the other attributes

## Acknowledgements

This project isn't directly affiliated with Bitfocus or Companion, but is obviously the backbone for this application. A huge thanks to the folks contributing to that project, especially [@krocheck](https://www.github.com/krocheck).
 - [Bitfocus Companion](https://bitfocus.io/companion)
