# .Net Web Assembly (wasm) Sample

The repository is a sample of working with .Net Web Assembly (wasm) in th browser

## Prerquistes


1. To use these samples you will need to have the wasm experimental workload installed

```pwsh
dotnet workload install wasm-experimental
```

2. You will also need the [.Net 9.0 SDK](https://dotnet.microsoft.com/download/dotnet/9.0) installed. For example on Windows

```pwsh
winget install Microsoft.DotNet.SDK.9
```

## Getting Started

1. Review the [Stopwatch](./src/stopwatch/README.md) sample

## Roadmap

Key elements of this project to investigate as time permits

1. **Web Worker Basic** - Minimal example of stopwatch where timer executes in a different web worker
2. **Alternate Location** - The ability to specify alternate _framework location
3. **PCF with WebApi** - The ability to run Stopwatch sample in PCF with [WebApi](./src/stopwatch-pcf/README.md)
3. **PCG with Web Worker** - Build on the PCF control and run the timer in a [Web Worker](./src/webworker/README.md)