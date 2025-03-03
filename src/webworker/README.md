# Overview

This project is the stopwatch template adapted to load dotnet in a [web worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers).

Key features:
- Load .Net Webassembly inside a web worker
- Pass in "start" argument that starts the Timer when triggered from postMessage
- Button for "Pause" to via postMessage and [JSExport] that call from JavaScript to C# using exported [JSExport] to pause the stopwatch
- Button for "Reset" to via postMessage and from JavaScript to C# using exported [JSExport] to reset the timer to 0:00
- All the timer execution occurs in the worker thread

## What is a Web Worker?
A web worker is a JavaScript script that runs in the background, independently of other scripts, without affecting the performance of the user interface. This allows for the execution of tasks that are computationally intensive or time-consuming without causing the web page to become unresponsive.

## Background Execution of Tasks
Web workers enable background execution of tasks by running scripts in a separate thread from the main execution thread of the web page. This means that tasks such as data processing, calculations, or fetching large amounts of data can be performed without blocking the user interface, ensuring a smooth and responsive user experience.

### Communication with Web Workers

#### postMessage

The primary method of communication between the main thread (UI code) and the web worker is through the postMessage method. This method allows the main thread to send messages to the web worker and vice versa. Messages can be simple strings or complex objects, and they are passed as arguments to the postMessage method.

#### Receiving Messages in the Web Worker
In the web worker, messages sent from the main thread are received using the onmessage event handler. This handler processes the incoming messages and performs the necessary actions based on the message content.

```javascript
self.onmessage = function(event) {
    // Process the message received from the main thread
    var data = event.data;
    // Perform actions based on the message content
};
```

#### Sending Messages from the Web Worker

Similarly, the web worker can send messages back to the main thread using the postMessage method. The main thread receives these messages using the onmessage event handler.

```javascript
// In the web worker
self.postMessage('Message from the web worker');

// In the main thread
worker.onmessage = function(event) {
    var data = event.data;
    // Process the message received from the web worker
};
```

### Importance for DotNet WebAssembly Projects

This approach can be particularly important for DotNet WebAssembly projects because, unlike other runtimes, each DotNet webassembly execution is single-threaded. By combining DotNet with WebAssembly and web workers, developers can achieve patterns that are closer to multithreaded execution. This is done by using messages to pass context between different worker threads, allowing for more efficient and responsive applications.

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
