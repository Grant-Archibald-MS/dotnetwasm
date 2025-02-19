# Overview

This project is the default stopwatch template of wasmbrowser.

Key features:
- Load .Net Webassembly
- Pass in "start" argument that starts the Timer
- Button for "Pause" to [JSExport] hat call from JavaScript to C# using exported [JSExport] to pause the stopwatch
- Button for "Reset" that call from JavaScript to C# using exported [JSExport] to reset the timer to 0:00
- All the execution occurs in the UI thread

## Getting Started

To get started

1. Change stopwatch sample

```pwsh
cd src\stopwatch
```

2. Run the sample

```pwsh
dotnet run
```
