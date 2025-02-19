# Overview

This project is the stopwatch template adapted to load dotnet in a [web worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers).

Key features:
- Load .Net Webassembly inside a web woerk
- Pass in "start" argument that starts the Timer when triggered from postMessage
- Button for "Pause" to via postMessage and [JSExport] that call from JavaScript to C# using exported [JSExport] to pause the stopwatch
- Button for "Reset" to via postMessage and from JavaScript to C# using exported [JSExport] to reset the timer to 0:00
- All the timer execution occurs in the worker thread

## Getting Started

To get started

1. Change stopwatch sample

```pwsh
cd src\webworker
```

2. Publish the sample

```pwsh
dotnet publish -o publish
```

3. Install web server to host the web worker. For example using npm

```pwsh
npm install -g http-server
```

4. Start the sample

```pwsh
cd publish\wwwroot
http-server
```
