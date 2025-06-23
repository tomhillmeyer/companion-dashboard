<img src="https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/refs/heads/main/assets/dashboard.png" width="200"></img>
# Companion Dashboard

This is an application for displaying variables from Bitfocus Companion.

## Installation
Download the latest releases [here](https://github.com/tomhillmeyer/companion-dashboard/releases) for Mac (ARM), Mac (Intel), and Windows (x64).

There is a TestFlight beta test for iPhone and iPad. To be added to the beta, contact me at [tom@tomhillmeyer.com](mailto:tom@tomhillmeyer.com).

## Example Layouts

| ![App Screenshot](https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/refs/heads/main/screenshots/sample-layout.png) | 
|:--:| 
| *The original inspiration, displaying variables for a live event environment with PowerPoint, video playback, and switching.* |

| ![Timer Demo](https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/refs/heads/main/demos/dashboard-timer/dashboard-timer-dashboard.png) | 
|:--:| 
| *Use Companion Dashboard to create a custom speaker timer. Check out this demo [here](https://github.com/tomhillmeyer/companion-dashboard/tree/main/demos/dashboard-timer).* |

| ![Spotify Example](https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/refs/heads/main/screenshots/spotify-demo.png) | 
|:--:| 
| *You can display information from apps like Spotify, complete with album art. Learn how this specific layout goes together [here](https://wearecreativeland.com/tools/dashboard/spotify-example).* |

| ![PiP Box Demo](https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/refs/heads/main/screenshots/pip-box-example.png) | 
|:--:| 
| *An out-of-the-box example of how flexible this application can be. This creates a background for a two-box look with dynamic fields for presentation and speaker names.* |

## Use cases

### Yamaha audio consoles
Use control keys and MIDI to control Companion directly from the console, and use Dashboard to monitor variables and feedback colors.

![App Screenshot](https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/refs/heads/main/screenshots/dashboard-DM7-usecase.png)

## How to use

![App Screenshot](https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/refs/heads/main/screenshots/settings-menu.png)

- The settings pane opens from the left side of the screen. Open it with the arrow / carrot in the bottom left of the viewport, or by swiping from the left on touch screen devices
- Input the address:port of your Companion instance and click "Set Connection." The outline around the address will turn green if it's connected to Companion.
- The canvas settings let you set a background color for the dashboard.
- Click "New Box" to add a new box to the canvas. "Clear All Boxes" clears all of the boxes off of the canvas.
- "Save" and "Load" allow you to download box details, layout, and Companion connection into a file to be restored from later. Loading a configuration replaces whatever configuration is in place.

![App Screenshot](https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/refs/heads/main/screenshots/resize-handles.png)

- Clicking a box once selects it and allows you to resize and move it on the canvas.

![App Screenshot](https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/refs/heads/main/screenshots/box-settings-modal.png)

- Double clicking a box launches the settings window for that box.

## Color logic
All color pickers in Companion Dashboard have three options, in this order of priority:
1. Variable color
2. Default Variable or HEX color
3. Default color picker

Clicking the green plus icon creates a new variable color. You input the Companion Variable, the value you want to look for, and then pick the color you want to apply when that variable has that value.

![App Screenshot](https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/refs/heads/main/screenshots/variable-color-modal.png)

Dashboard prioritizes the variable colors from the top down. If all variable colors are false, it will check for a default variable or HEX color from that text field. If that text field is empty, it will use the default color picker value.

## Markdown and HTML tags
All text fields support HTML tags and the following markdown syntax.
- **Bold**
    - `<b>Text\</b>`
    - `**Text\*\*`
    - `__Text__`
- *Italics*
    - ```<i>Text</i>```
    - ```*Text*```
    - ```_Text_```
- New Line
    - `<br>`
- Image
    - `!(Sample Image)[https://website.com/image.png]`
        - Image with this tag will fill the height of the box and automatically determine width
    - `<img src="https://website.com/image.png" width="100px" height="100px" />`
- Links
    - `(Link Text)[https://website.com]`
- Video / iFrame
    - `<iframe src="https://website.com" width="100px" height="100px" />`


## Tips & Tricks
- Text fields automatically concatenate, so you can include multiple variables and strings
- Option + Click a box and it will duplicate
- Select a box and hit "backspace" or "delete" to delete
- Swipe left on touch screens to open the Settings menu
- Use `&nbsp` in some circumstances where a white space isn't recognized

## Demos
[Countdown Timer Demo](https://github.com/tomhillmeyer/companion-dashboard/tree/main/demos/dashboard-timer)

[Custom Variables & Triggers](https://wearecreativeland.com/tools/dashboard/custom-variables-triggers)

## Philosophy

This is a dashboard application that leverages the fact that Companion translates connections into a uniform variable format. The intention is to avoid re-creating features of Companion, such as logic/triggers and third-party connections. Some logic will be included for ease of use, such as variable colors, but for the most part if it can be accomplished in Companion then it does not need to be accomplished here, at least in this iteration of Dashboard.

## Acknowledgements

This project isn't directly affiliated with Bitfocus or Companion, but is obviously the backbone for this application. A huge thanks to the folks contributing to that project, especially [@krocheck](https://www.github.com/krocheck).
 - [Bitfocus Companion](https://bitfocus.io/companion)