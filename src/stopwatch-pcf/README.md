# Overview

This sample aimes to demonstrate how to load a .Net Web Assembly stopwatch sample inside a PCF Control using Web Resources

This sample was created using the following command

```pwsh
pac pcf init -n Stopwatch -ns WebAssembly -t field -npm
```

## Prerequistes

1. You have Power Platform Command Line Interface [installed](https://learn.microsoft.com/power-platform/developer/cli/introduction?tabs=windows). 

2. You have NodeJs [installed](https://nodejs.org/en/download/). 

## Getting Started

1. Change to stopwatch folder

```pwsh
cd Stopwatch
```

2. Install components

```pwsh
npm install
```

3. Run the sample

```pwsh
npm run start
```

## Web Resources

Web resources in Power Apps are virtual files stored in the Microsoft Dataverse database. They can be used to extend the functionality of model-driven apps or PCF controls by adding custom HTML, JavaScript, CSS, and other file types. Here are some key points to consider when working with web resources:

### Limitations of Web Resources

1. [**File Size Limitations**](https://learn.microsoft.com/power-apps/developer/model-driven-apps/web-resources#size-limitations): By default, the maximum size for a web resource file is 5MB. This limit can be increased if necessary by adjusting the system settings under the Email tab. For larger files, consider breaking them into smaller parts or using alternative storage solutions.

2. [**Supported File Types**](https://learn.microsoft.com/power-apps/developer/model-driven-apps/web-resources##web-resource-types): Power Apps web resources support a variety of file types, including HTML, JavaScript, CSS, XML, and image formats like PNG, JPG, and GIF. However, certain file types such as `.wasm`, `.wasm.gz`, `.dat`, `.wasm.br`, and `.dat.br` are not supported. Given dotnetwasm uses these file types, we will consider using alternative extensions or methods to include them in the project.

3. **Execution Context**: Web resources are limited to static files or files processed in the browser. They do not support server-side execution like ASP.NET (.aspx) pages. This means that any code within a web resource must be executed on the client side.