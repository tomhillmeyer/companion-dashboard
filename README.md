<img src="https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/refs/heads/main/assets/dashboard.png" width="200"></img>
# Companion Dashboard

This is an application for displaying variables from Bitfocus Companion. A companion for Companion, if you will.

It is a display of boxes you can resize and move. Each of those boxes has an option for a header field, left field, and right field. Any or all of those fields can be hidden, and all consist of text fields that can display Companion variable values, markdown, HTML, or plain text.

If you found this app helpful, consider buying me a coffee so I can keep making it better!

<a href="https://buymeacoffee.com/mmpqmow7hg"><img src="https://www.owlstown.com/assets/icons/bmc-yellow-button-941f96a1.png" width="150"></a>


## Installation
Download the latest releases [here](https://github.com/tomhillmeyer/companion-dashboard/releases) for Mac (ARM), Mac (Intel), Linux (amd64), Linux (arm64) and Windows (x64).

There is a TestFlight beta test for iPhone and iPad. To be added to the beta, contact me at [tom@tomhillmeyer.com](mailto:tom@tomhillmeyer.com).

## Example Layouts

| ![App Screenshot](https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/refs/heads/main/screenshots/sample-layout.png) | 
|:--:| 
| The original inspiration, displaying variables for a live event environment with PowerPoint, video playback, and switching. |

| ![App Screenshot](https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/refs/heads/main/screenshots/video-switcher-example.png) | 
|:--:| 
| An example of how a video switcher can use it to keep track of inputs and outputs. |

| ![Timer Demo](https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/refs/heads/main/demos/dashboard-timer/dashboard-timer-dashboard.png) | 
|:--:| 
| Use Companion Dashboard to create a custom speaker timer. 
*Check out this demo [here](https://github.com/tomhillmeyer/companion-dashboard/tree/main/demos/dashboard-timer).* |

| ![Spotify Example](https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/refs/heads/main/screenshots/spotify-demo-2.png) | 
|:--:| 
| You can display information from apps like Spotify, complete with album art. You can even use expression variables and background overlays to make a Spotify progress bar.
*See how this layout goes together [here](https://wearecreativeland.com/tools/dashboard/spotify-example).*
*See how to set up a media progress bar [here](https://wearecreativeland.com/tools/dashboard/expression-variables-overlay).*|


| ![PiP Box Demo](https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/refs/heads/main/screenshots/pip-box-example.png) | 
|:--:| 
| An out-of-the-box example of how flexible this application can be. This creates a background for a two-box look with dynamic fields for presentation and speaker names.
*See how this layout goes together [here](https://wearecreativeland.com/tools/dashboard/pip-box-example).* |



## Example deployments

| ![App Screenshot](https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/refs/heads/main/screenshots/dashboard-DM7-usecase.png) | 
|:--:| 
| **Yamaha Audio Consoles**
Use control keys and MIDI to control Companion directly from the console, and use Dashboard to monitor variables and feedback colors. |

| ![App Screenshot](https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/refs/heads/main/screenshots/dashboard-ppt-usecase.jpg) | 
|:--:| 
| **PowerPoint**
Use Dashboard to see more data than what PowerPoint itself shows you while in presentation mode ([OSCPoint](https://oscpoint.com/) being used here) |

| ![App Screenshot](https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/refs/heads/main/screenshots/dashboard-playback-usecase.JPG) | 
|:--:| 
| **Media Playback and Video Switcher**
Keep tabs on both device status and playback position on the same screen. |

# How to use

### The Settings Pane

- The settings pane opens from the left side of the screen. Open it with the arrow / carrot in the bottom left of the viewport, or by swiping from the left on touch screen devices
- The lock/unlock button next to the arrow / carrot will lock the boxes in place and they can't be resized or moved. When the boxes are locked, they can be interacted with (using `<iframe>` or `<button>`, etc.)

![App Screenshot](https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/refs/heads/main/screenshots/settings-menu.png)


### Resizing and moving boxes

- Clicking a box once selects it and allows you to resize and move it on the canvas.
- The lock in the bottom left will toggle the ability to click boxes to resize and move them.

![App Screenshot](https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/refs/heads/main/screenshots/resize-handles.png)


### Box Settings

- Double clicking a box launches the settings window for that box.

![App Screenshot](https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/refs/heads/main/screenshots/box-settings-modal.png)

# Parameters and logic
### Variables
- Including a variable in the standard Companion notation of `$(connection:variable)` will automatically replace that variable with its value on your dashboard.
- The variable by itself will use the default Companion connection. If you add `[X]` immediately before the variable, it'll use that connection. For example, `[1]$(connection:variable)` will pull that variable from the [1] connection rather than the default connection.

### Color logic
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
    - `<b>Text</b>`
    - `**Text**`
    - `__Text__`
- *Italics*
    - ```<i>Text</i>```
    - ```*Text*```
    - ```_Text_```
- New Line
    - `\n`
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
- Option + click a box and it will duplicate
- Command/control + n will make a new box
- Command/control + , is a shortcut to open/close the settings menu
- Select a box and hit "backspace" or "delete" to delete
- Swipe left on touch screens to open the Settings menu
- Use `&nbsp` in some circumstances where a white space isn't recognized
- Under the "Window" menu bar setting is the ability to keep Dashboard always on top of your other applications

## Demos
[Countdown Timer Demo](https://github.com/tomhillmeyer/companion-dashboard/tree/main/demos/dashboard-timer)

[Custom Variables & Triggers](https://wearecreativeland.com/tools/dashboard/custom-variables-triggers)

## Philosophy

This is a dashboard application that leverages the fact that Companion translates connections into a uniform variable format. The intention is to avoid re-creating features of Companion, such as logic/triggers and third-party connections. Some logic will be included for ease of use (such as variable colors) but for the most part if it can be accomplished in Companion then it does not need to be accomplished here, at least in this iteration of Dashboard.

## Acknowledgements

This project isn't directly affiliated with Bitfocus or Companion, but is obviously the backbone for this application. A huge thanks to the folks contributing to that project, especially [@krocheck](https://www.github.com/krocheck).
 - [Bitfocus Companion](https://bitfocus.io/companion)