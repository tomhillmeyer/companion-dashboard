# Companion Dashboard Timer
This is a Dashboard demo using the Generic: Stopwatch module in Companion to create a simple customizable countdown timer output.

NOTE: This Companion configuration is built in v4.0.0 and Dashboard v1.0.0

### Files & Installation
- [Companion Configuration File](https://github.com/tomhillmeyer/companion-dashboard/blob/main/demos/dashboard-timer/dashboard-timer-companion-configuration-v1.0.0.companionconfig)
    - Import this configuration into Companion on the import/export page
- [Dashboard Configuration File](https://github.com/tomhillmeyer/companion-dashboard/blob/main/demos/dashboard-timer/dashboard-timer-dashboard-configuration-v1.0.0.json)
    - Use this configuration into Dashboard using "Restore Config"

### How to use

![App Screenshot](https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/refs/heads/main/demos/dashboard-timer/dashboard-timer-companion.png)

The Companion configuration already includes a page of buttons, pre-programmed to control the timer including
- +1, +5, +10, and -1 minute adjustments
- 10, 30, 60, and 90 minute shortcuts
- Next full, half, and quarter hour shortcuts
- "Count up on end" toggle
     - When enabled, when the timer hits 00:00:00 it will turn red and begin counting up
     - When disabled, the timer will stay at 00:00:00
- Start / Pause button and timer preview
- "Ends at time" label
    - Displays what time the timer will end, based on system time
- "Clear" button
    - Stops timer and resets to "00:00:00"

![App Screenshot](https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/refs/heads/main/demos/dashboard-timer/dashboard-timer-dashboard.png)

The Dashboard configuration includes a large timer output box, as well as boxes for when the timer will end and the current time.