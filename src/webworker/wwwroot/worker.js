
self.onmessage = async function (event) {
    console.log(event.data)
    if (typeof self.setup == "undefined") {
        // Dynamically import dotnet.js
        const { dotnet } = await import('./_framework/dotnet.js');

        const { getAssemblyExports, getConfig, runMain } = await dotnet
        .withApplicationArguments("start")
        .create();

        const config = getConfig();
        const exports = await getAssemblyExports(config.mainAssemblyName);
        self.setup = true;

        self.postMessage('ready');

        // run the C# Main() method and keep the runtime process running and executing further API calls
        await runMain();
    } 
}