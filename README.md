<img src="https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/refs/heads/main/assets/dashboard.png" width="200"></img>
# Companion Dashboard

This is an application for displaying variables from Bitfocus Companion. A companion for Companion, if you will.

It is a display of boxes you can resize and move. Each of those boxes has an option for a header field, left field, and right field. Any or all of those fields can be hidden, and all consist of text fields that can display Companion variable values, markdown, HTML, or plain text.

### App documentation can be found [here](https://wearecreativeland.com/tools/dashboard/companion-dashboard-documentation)!


## Installation & Getting Started
Read about getting started in the app docs [here](https://apps.wearecreativeland.com/dashboard/docs/installation-getting-started)

### Desktop Releases
Download the latest releases [here](https://github.com/tomhillmeyer/companion-dashboard/releases) for Mac (ARM), Mac (Intel), Linux (amd64), Linux (arm64) and Windows (x64).


### Linux Server (Raspberry Pi, NUC, etc.)
Install a Debian Linux installation such as Raspberry Pi OS, Ubuntu Server, or Companion Pi. After installation, running this script will install the latest release of the app from GitHub, or update an already existing installation. Supports ARM (Raspberry Pi, etc.) and Intel (Intel NUC, etc.).

Dashboard will launch full screen upon boot. It is the full version of the app, but also auto-starts the web server for remote configuration.

Run this script to install, either directly on the device or over SSH:

`curl -fsSL https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/main/install.sh | bash`

Requires a reboot after installation:

`sudo reboot`

### iOS TestFlight

There is a TestFlight beta test for iPad. To be added to the beta, contact me at [tom@tomhillmeyer.com](mailto:tom@tomhillmeyer.com).


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


## Demos
[Countdown Timer Demo](https://github.com/tomhillmeyer/companion-dashboard/tree/main/demos/dashboard-timer)

[Custom Variables & Triggers](https://wearecreativeland.com/tools/dashboard/custom-variables-triggers)

[Using Expression Variables with 
Background Overlays](https://wearecreativeland.com/tools/dashboard/expression-variables-overlay)

## Philosophy

This is a dashboard application that leverages the fact that Companion translates connections into a uniform variable format. The intention is to avoid re-creating features of Companion, such as logic/triggers and third-party connections. Some logic will be included for ease of use (such as variable colors) but for the most part if it can be accomplished in Companion then it does not need to be accomplished here, at least in this iteration of Dashboard.

## Acknowledgements

This project isn't directly affiliated with Bitfocus or Companion, but is obviously the backbone for this application. A huge thanks to the folks contributing to that project, especially [@krocheck](https://www.github.com/krocheck).
 - [Bitfocus Companion](https://bitfocus.io/companion)


##

If you found this app helpful, consider buying me a coffee so I can keep making it better!

<a href="https://buymeacoffee.com/mmpqmow7hg"><img src="https://www.owlstown.com/assets/icons/bmc-yellow-button-941f96a1.png" width="150"></a>