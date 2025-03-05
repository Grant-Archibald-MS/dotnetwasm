// Sample Web Worker for a Blazor WebAssembly application.

// It listens for messages from the main thread and responds accordingly.
//
// The main message handled for the worker are:
// - loadWasm: Loads the WebAssembly module and sets up the environment using the blobUrl from the main thread.
// - reset: Resets the stopwatch sample using JavaScript interop.
// - toggle: Toggles the stopwatch sample and sends the current state back to the main thread.
// - fetchResponse: Handles the response from the fetch request made by the worker.
//

let exports = null;
self.orginalFetch = self.fetch;

// SKIP UPDATE

self.onmessage = async function(e) {
    const { type, data } = e.data;

    if (type === 'loadWasm') {
        const blobUrl = data;

        // Check if the blob URL is valid
        if (!blobUrl.startsWith('blob:')) {
            console.error('Invalid blob URL:', blobUrl);
            self.postMessage({ type: 'error', message: 'Invalid blob URL' });
            return;
        }

        try {
            // Fetch the blob content to ensure it's accessible
            const response = await self.orginalFetch(blobUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch blob content: ${response.statusText}`);
            }

            // Check the MIME type of the blob
            const contentType = response.headers.get('Content-Type');
            if (contentType !== 'application/javascript') {
                throw new Error(`Invalid MIME type: ${contentType}`);
            }

            // Dynamically import the module from the blob URL
            const module = await import(blobUrl);
            const { setModuleImports, getAssemblyExports, getConfig, runMain } = await module.dotnet
                .withConfigSrc(self.location.origin + "/_framework/blazor.boot.json")
                .withApplicationArguments("start")
                .create();

            setModuleImports('main.js', {
                dom: {
                    setInnerText: (selector, time) => {
                        self.postMessage({ type: 'setInnerText', selector, time });
                    }
                }
            });

            const config = getConfig();
            exports = await getAssemblyExports(config.mainAssemblyName);

            self.postMessage({ type: 'exportsReady' });

            // Run the main function to start the application in the worker thread
            await runMain();
        } catch (error) {
            console.error('Error loading WASM module:', error);
            self.postMessage({ type: 'error', message: error.message });
        }
    } else if (type === 'reset') {
        exports.StopwatchSample.Reset();
    } else if (type === 'toggle') {
        const isRunning = exports.StopwatchSample.Toggle();
        self.postMessage({ type: 'toggle', isRunning });
    }
};


self.fetch = async function(input, init) {
    return new Promise((resolve, reject) => {
        self.postMessage({ type: 'fetch', data: input });

        self.onmessage = function(e) {
            if (e.data.type === 'fetchResponse' && e.data.url === input) {
                const headers = new Headers(e.data.headers);
                let response;

                if (e.data.responseType === 'arrayBuffer') {
                    response = new Response(e.data.data, {
                        headers: headers,
                        status: e.data.status,
                        statusText: e.data.statusText
                    });
                } else if (e.data.responseType === 'text') {
                    response = new Response(e.data.data, {
                        headers: headers,
                        status: e.data.status,
                        statusText: e.data.statusText
                    });
                }
                resolve(response);
            }
        };
    });
};

// Override globalThis.fetch to use the custom fetch implementation
globalThis.fetch = self.fetch;

globalThis.customImport = async (url) => {
    const response = await globalThis.fetch(url);
    let text = await response.text();
    if (text.indexOf('// SKIP') == -1) { 
        text = text.replaceAll('await import(', 'await globalThis.customImport(');
    }
    const jsonBlob = new Blob([text], { type: 'application/javascript' });  
    return import(/* webpackIgnore: true */ URL.createObjectURL(jsonBlob));
}

globalThis.getDocument = function() {
    // Get the current worker URL host
    const currentHost = self.location.origin;
    const hostURL = new URL(currentHost);

    // Append "/_framework" to the current host
    const newUrl = `${currentHost}/_framework/`;

    // Create a mock document object
    return {
        baseURI: newUrl,
        location: {
            href: newUrl,
            host: hostURL.host,
            origin: currentHost,
            pathname: '/_framework/',
            search: '',
            hash: '',
        }
    }
}