import { IInputs, IOutputs } from "./generated/ManifestTypes";

/**
 * @title StopwatchWorker
 * @description StopwatchWorker control that demonstrates the use of Web Workers in a PCF control.
 * @summary This control uses a Web Worker to perform time calculations and updates the UI with the stopwatch time.
 * @author Grant Archibald
 */
export class StopwatchWorker implements ComponentFramework.StandardControl<IInputs, IOutputs> {

    private container: HTMLDivElement;
    private _context: ComponentFramework.Context<IInputs>
    private baseUrl: string;
     // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private originalFetch: any;
    private worker: Worker | null;

    /**
     * Empty constructor.
     */
    constructor()
    {
        this.worker = null;
    }

    private  handleWorkerMessage(e: MessageEvent): void {
        const { type, data } = e.data;

        switch (type) {
            case 'setInnerText': {
                const element = this.container.querySelector(data.selector);
                if (element) {
                    (element as HTMLElement).innerText = data.time;
                }
                break;
            }
            case 'toggle': {
                const pauseButton = this.container.querySelector("#pause") as HTMLElement;
                if (pauseButton) {
                    pauseButton.innerText = data.isRunning ? 'Pause' : 'Start';
                }
            }
                break;
            case 'fetch': {
                globalThis.fetch(data);
                break;
            }
        } 
    }

    /**
     * Used to initialize the control instance. Controls can kick off remote server calls and other initialization actions here.
     * Data-set values are not initialized here, use updateView.
     * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to property names defined in the manifest, as well as utility functions.
     * @param notifyOutputChanged A callback method to alert the framework that the control has new outputs ready to be retrieved asynchronously.
     * @param state A piece of data that persists in one session for a single user. Can be set at any point in a controls life cycle by calling 'setControlState' in the Mode interface.
     * @param container If a control is marked control-type='standard', it will receive an empty div element within which it can render its content.
     */
    public async init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void, state: ComponentFramework.Dictionary, container:HTMLDivElement): Promise<void>
    {
        this.container = container;
        this._context = context;
        this.loadHtmlContent();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const windowInstance = window as any;

        // Dynamically set the base URL so that can handle relative paths for .Net WASM files
        this.baseUrl = windowInstance.location.origin + "/_framework/";

        this.overrideFetch();

        const baseElement = document.createElement("base");
        baseElement.href = this.baseUrl;
        document.head.appendChild(baseElement);

        // Fetch the worker.js file from WebApi
        const response = await fetch(`${this.baseUrl}worker.js`);
        const workerScript = await response.text();
        const blob = new Blob([workerScript], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);

        // Create a new Worker instance using the blob URL
        this.worker = new Worker(blobUrl);

        // Handle messages from the worker
        this.worker.onmessage = this.handleWorkerMessage.bind(this);

        // TODO: Configuring the app to fetch and decode Brotli compressed files *.br not gz)
        const id = await this.getFileIdentifer('dotnet.js.gz');
        this.fetchDotNetJsContent(id);
    }

    /**
     * Overrides the fetch method for _framework files so that can load files from the WebApi rather than static files
     */
    private overrideFetch() : void {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const globalThisInstance = globalThis as any;
        if (typeof this.originalFetch === 'undefined') {
            this.originalFetch = globalThisInstance.fetch;
        }

        globalThisInstance.fetch = async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
            let url;
            if (typeof input === 'string') {
                url = input;
            } else if (input instanceof Request) {
                url = input.url;
            }
            console.log("Fetch URL", url);

            const originalUrl = url || '';

            // Check if load file from the root path
            const rootFile = url?.replace(this.baseUrl.replace('_framework/',''),'').indexOf('/') == -1;
        
            if (url && (url.startsWith(this.baseUrl) || rootFile)) {
                // Fetch the file from WebApi with .gz extension
                url = url.replace(this.baseUrl, '');
                url = url.replace(this.baseUrl.replace('_framework/',''), '');

                if (!url.endsWith('.gz')) {
                    url += '.gz';
                }
                const fileId = await this.getFileIdentifer(url);
                const fileContent = await this.fetchFileFromWebApi(fileId);
                let mimeType = url.endsWith('.json.gz') ? 'application/json' : 'application/javascript';
                if (url.endsWith('.js.gz')) {
                    mimeType = 'application/javascript';
                }
                if (url.endsWith('.wasm.gz')) {
                    mimeType = 'application/wasm';
                }
                if (url.endsWith('.dat.gz')) {
                    mimeType = 'application/dat';
                }

                let response: Response;
                let responseType = 'arrayBuffer';
                let data: Uint8Array | string;
            
                if (mimeType == 'application/javascript') {
                    let decompressedFileContent = await this.decompressFileContentText(fileContent);
                    decompressedFileContent = this.PCFEnableDotNetJs(decompressedFileContent);
                    responseType = 'text';
                    data = decompressedFileContent;
                    response = new Response(decompressedFileContent, { headers: { 'Content-Type': mimeType } });
                } else {
                    const decompressedFileContent = await this.decompressFileContentArray(fileContent);
                    data = decompressedFileContent;
                    response = new Response(decompressedFileContent, { headers: { 'Content-Type': mimeType } });
                }

                if (this.worker !== null) {
                    // Send the data to the worker
                    this.worker.postMessage({
                        type: 'fetchResponse',
                        url: originalUrl,
                        data: data,
                        headers: (() => {
                            const headersArray: [string, string][] = [];
                            response.headers.forEach((value, key) => {
                                headersArray.push([key, value]);
                            });
                            return headersArray;
                        })(),
                        status: response.status,
                        statusText: response.statusText,
                        responseType: responseType
                    });
                }

                return response;
            }
        
            return this.originalFetch(input, init);
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const windowInstance = window as any;
        windowInstance.fetch = globalThisInstance.fetch;
    }

    /**
     * Gets the file identifier for the specified file name using a lookup in the WebApi
     * @param fileName The name of the file to get the identifier for
     * @returns The unique identifier of the file in Dataverse WebApi
     */
    private async getFileIdentifer(fileName: string): Promise<string> {
        if (!fileName.endsWith('.gz')) {
            fileName += '.gz';
        }
        // Query the record with name 'dotnet.js.gz' in the 'dev_name' field
        const query = `?$filter=dev_name eq '${fileName}'`;
        try {
            const result = await this._context.webAPI.retrieveMultipleRecords("dev_webassembly", query);
            if (result.entities.length > 0) {
                // Record found, proceed to retrieve the dev_content column
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return result.entities[0]["dev_webassemblyid"];
            } else {
                throw new Error("No record found with the specified name.");
            }
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.error(error.message);
            throw error;
        }
    }

    /**
     * Fetches the file content from the WebApi
     * @param fileId The unique identifier of the record to retreieve the file content for
     * @returns 
     */
    private async fetchFileFromWebApi(fileId: string): Promise<string> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const context: any = this._context;
        const baseUrl = context.page.getClientUrl();
        const url = `${baseUrl}/api/data/v9.2/dev_webassemblies(${fileId})/dev_content`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json;odata=verbose'
            }
        });
        const data = await response.json();
        return data.value;
    }

    /**
     * Decompresses the file content from a gzip file content and loads it into the application as text
     * @param fileContent The file content as a base64 encoded string.
     * @returns The uncompressed file content as a string
     */
    private async decompressFileContentText(fileContent: string): Promise<string> {
        const binaryString = atob(fileContent);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/gzip' });
        const ds = new DecompressionStream('gzip');
        const decompressedStream = blob.stream().pipeThrough(ds);
        const decompressedBlob = await new Response(decompressedStream).blob();

        // Convert the decompressed content to text
        return await decompressedBlob.text();
    }

    /**
     * Decompresses the file content from a gzip file content and loads it into the application as binary array
     * @param fileContent The file content as a base64 encoded string.
     * @returns The uncompressed file content as a binary array
     */
    private async decompressFileContentArray(fileContent: string): Promise<Uint8Array> {
        const binaryString = atob(fileContent);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/gzip' });
        const ds = new DecompressionStream('gzip');
        const decompressedStream = blob.stream().pipeThrough(ds);
        const decompressedBlob = await new Response(decompressedStream).blob();

        // Convert the decompressed content to array
        return await this.blobToByteArray(decompressedBlob);
    }

    private async blobToByteArray(blob: Blob) : Promise<Uint8Array> {
        return blob.arrayBuffer().then(function(arrayBuffer) {
            return new Uint8Array(arrayBuffer);
        });
    }

    /**
     * Fetches the dotnet.js file content from the WebApi.
     * @param fileIdentifier The unique identifier of the record to retreieve the file content for
     */
    private fetchDotNetJsContent(fileIdentifier: string): void {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const context: any = this._context;
        const baseUrl = context.page.getClientUrl();
        const url = `${baseUrl}/api/data/v9.2/dev_webassemblies(${fileIdentifier})/dev_content`;
        fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            const fileContent = data.value;
            this.decompressDotNetJsFileContent(fileContent);
        })
        .catch(error => {
            console.error(error.message);
        });
    }

    /**
     *  Decompresses the dotnet.js from a gzip file content and loads it into the application.
     * @param fileContent The file content as a base64 encoded string.
     */
    private async decompressDotNetJsFileContent(fileContent: string): Promise<void> {
        const binaryString = atob(fileContent);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/gzip' });
        const ds = new DecompressionStream('gzip');
        const decompressedStream = blob.stream().pipeThrough(ds);
        const decompressedBlob = await new Response(decompressedStream).blob();

        // Convert the decompressed content to text
        const decompressedTextContent = this.PCFEnableDotNetJs(await decompressedBlob.text());
       
        // Create a JSON Blob with the correct MIME type
        const jsonBlob = new Blob([decompressedTextContent], { type: 'application/javascript' });  
        
        // Create a URL for the JSON Blob and pass it to loadDotnetJs
        await this.loadDotnetJs(URL.createObjectURL(jsonBlob));
    }

    /**
     * Modifies the dotnet.js and related JavaScript content to enable it to work in PCF.
     * @param dotnetJsContent The content of the dotnet.js file
     * @returns The modified content of the dotnet.js file
     */
    private PCFEnableDotNetJs(dotnetJsContent: string): string {
        // **** IMPORTANT *****
        // This code is work in progress PREVIEW code that looks to apply changes to dotnet.js and related WASM runtime code to enable them to work in PCF
        // The code and dotnet.js code is subject to change at any time
        
        // ASSUMPTIONS:
        // 1. globalThis.fetch and window.fetch have been overridden to use the custom fetch implementation
        // 2. The custom fetch implementation will load the .gz files from the WebApi
        // 3. Requests not related to baseUrl will be passed to the original fetch implementation
        // 4. JavaScript librarues are loaded as blob URLs and will redirect to baseUrl + "/framework/" path
        // 5. Only supported in Model Driven Application or Custom Page of MDA as requires calls to WebApi

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const globalThisInstance = globalThis as any;

        globalThisInstance.getDocument = () => { return document; };

        // Check if this file wants to opt out of the changes
        if (dotnetJsContent.indexOf('// SKIP') == -1) { 
            // It does not lets apply standard updates 
            
            // Refer to the PCF control not the module
            dotnetJsContent = dotnetJsContent.replaceAll("globalThis.document", `globalThis.getDocument()`);

            // Replace script directory to remove the blob: prefix
            dotnetJsContent = dotnetJsContent.replaceAll("qe.locateFile=", "qe.scriptDirectory=qe.scriptDirectory.replace('blob:',''),qe.scriptDirectory+='_framework/',qe.locateFile=");

            // Lets fix custom import js using blob

            // ... Make import custom import using WebApi rather than direct request
            dotnetJsContent = dotnetJsContent.replaceAll("=import(", "=globalThis.customImport(");
            dotnetJsContent = dotnetJsContent.replaceAll("await import(", "await globalThis.customImport(");

            // Fix the URL for dotnet.native.wasm to load relatd to import.meta.url
            dotnetJsContent = dotnetJsContent.replaceAll('new URL("dotnet.native.wasm",import.meta.url)', `new URL("dotnet.native.wasm",'https://'+globalThis.getDocument().location.host+'/_framework/')`);
            dotnetJsContent = dotnetJsContent.replaceAll('_scriptDir = import.meta.url', '_scriptDir = "https://"+globalThis.getDocument().location.host+"/_framework/"');

            // Replace readAsync with globalThis.fetch
            dotnetJsContent = dotnetJsContent.replaceAll('DOTNET.setup', 'readAsync = (filename, onload, onerror, binary = true) => globalThis.fetch(new URL(filename)).then(response => response.ok ? (binary ? response.arrayBuffer() : response.text()).then(onload) : Promise.reject(response.statusText)).catch(onerror);DOTNET.setup');
        }

        globalThisInstance.customImport = async (url: string) => {
            const response = await globalThisInstance.fetch(url);
            let text = await response.text();
            if (text.indexOf('// SKIP') == -1) { 
                text = text.replaceAll('await import(', 'await globalThis.customImport(');
            }
            const jsonBlob = new Blob([text], { type: 'application/javascript' });  
            return import(/* webpackIgnore: true */ URL.createObjectURL(jsonBlob));
        }

        return dotnetJsContent;
    }

    /**
     * Loads the HTML content into the container. The #time div will be updated with the stopwatch time.
     */
    private loadHtmlContent(): void {
        const htmlContent = `
            <div id="control-container">
                <button id="reset" style="color:red">Reset</button>
                <button id="pause" style="color:green">Pause</button>
                <div id="time"></div>
            </div>
        `;
        this.container.innerHTML = htmlContent;

        document.getElementById('reset')!.addEventListener('click', () => {
            if (this.worker !== null) {
                this.worker.postMessage({ type: 'reset' });
            }
        });

        const pauseButton = document.getElementById('pause')!;
        pauseButton.addEventListener('click', () => {
            if (this.worker !== null) {
                this.worker.postMessage({ type: 'toggle' });
            }
        });
    }

    /**
     * Async loads the dotnet.js file and initializes the DotNet Web Assembly application.
     * @param blobUrl The Blob URL of the dotnet.js file.
     */
    private async loadDotnetJs(blobUrl: string): Promise<void> {   
        try {
            if (this.worker !== null) {
                this.worker.postMessage({ type: 'loadWasm', data: blobUrl });
            }
        }
        catch (error) {
            console.error("Error loading dotnet.js", error);
        }
    }

    /**
     * Called when any value in the property bag has changed. This includes field values, data-sets, global values such as container height and width, offline status, control metadata values such as label, visible, etc.
     * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to names defined in the manifest, as well as utility functions
     */
    public updateView(context: ComponentFramework.Context<IInputs>): void
    {
        // Add code to update control view
    }

    /**
     * It is called by the framework prior to a control receiving new data.
     * @returns an object based on nomenclature defined in manifest, expecting object[s] for property marked as "bound" or "output"
     */
    public getOutputs(): IOutputs
    {
        return {};
    }

    /**
     * Called when the control is to be removed from the DOM tree. Controls should use this call for cleanup.
     * i.e. cancelling any pending remote calls, removing listeners, etc.
     */
    public destroy(): void
    {
        // Add code to cleanup control if necessary
    }
}
