# Overview

This sample aims to demonstrate how to load a .Net Web Assembly stopwatch sample inside a PCF Control with web workers using WebAPI that extends the [Stopwatch PCF](../../stopwatch-pcf/README.md)

This sample was created using the following command

```pwsh
pac pcf init -n StopwatchWorker -ns WebAssembly -t field -npm
```

## Prerequisites

1. You have Power Platform Command Line Interface [installed](https://learn.microsoft.com/power-platform/developer/cli/introduction?tabs=windows). 

2. You have NodeJs [installed](https://nodejs.org/en/download/). 

## Getting Started

1. Change to stopwatch folder

```pwsh
cd StopwatchWorker
```

2. Install components

```pwsh
npm install
```

3. Ensure yor tsconfig.json has been updated

```json
{
    "extends": "./node_modules/pcf-scripts/tsconfig_base.json",
    "compilerOptions": {
        "allowSyntheticDefaultImports": true,
        "typeRoots": ["node_modules/@types", "./Stopwatch/types"],
        "lib": ["dom", "es2021"]
    }
}
```

3. Run the sample

```pwsh
npm run start
```

## Package the solution

To package a version of the PCF control

1. Build the control

```pwsh
npm run build
```

2. Make to solution folder

```pwsh
md stopwatch_worker_pcf_control
```

3. Change to solution folder

```pwsh
cd stopwatch_worker_pcf_control
```

4. Create a solution using 

```pwsh
pac solution init --publisher-name developer --publisher-prefix dev
```

5. Reference the created project

```pwsh
pac solution add-reference --path ..
```

6. Generate the package

```pwsh
dotnet build
```

6. Upload the create **stopwatch_worker_pcf_control.zip** to your environment

## Web Workers

When dealing with web workers authentication tokens need to be obtained or used from the UX thread and data shared with worker thread via postMessage