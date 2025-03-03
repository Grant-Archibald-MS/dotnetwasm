import { Console } from "console";
import { IInputs, IOutputs } from "./generated/ManifestTypes";

export class Stopwatch implements ComponentFramework.StandardControl<IInputs, IOutputs> {

    private container: HTMLDivElement;
    private _context: ComponentFramework.Context<IInputs>
    private baseUrl: string;
     // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private originalFetch: any;

    /**
     * Empty constructor.
     */
    constructor()
    {

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
        //this.overrideXMLHttpRequest();

        const baseElement = document.createElement("base");
        baseElement.href = this.baseUrl;
        document.head.appendChild(baseElement);

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
             
                if (mimeType == 'application/javascript') {
                    let decompressedFileContent = await this.decompressFileContentText(fileContent);
                    decompressedFileContent = this.PCFEnableDotNetJs(decompressedFileContent);
                    response = new Response(decompressedFileContent, { headers: { 'Content-Type': mimeType } });
                } else {
                    const decompressedFileContent = await this.decompressFileContentArray(fileContent);
                    response = new Response(decompressedFileContent, { headers: { 'Content-Type': mimeType } });
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

        globalThisInstance.customImport = async (url: string) => {
            const response = await globalThisInstance.fetch(url);
            let text = await response.text();
            text = text.replaceAll('await import(', 'await globalThis.customImport(');
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
    }

    /**
     * Async loads the dotnet.js file and initializes the DotNet Web Assembly application.
     * @param blobUrl The Blob URL of the dotnet.js file.
     */
    private async loadDotnetJs(blobUrl: string): Promise<void> {    
        try {
            const module = await import(/* webpackIgnore: true */ blobUrl);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (typeof module.dotnet === "undefined") {
                console.error("Dotnet instance is undefined");
                return;
            }

            // Override the fetch method to use the custom fetch implementation
            this.overrideFetch();
        
            const { setModuleImports, getAssemblyExports, getConfig, runMain } = await module.dotnet
                .withConfigSrc(this.baseUrl + "blazor.boot.json")
                .withApplicationArguments("start")
                .create();

            // Define the type for the dom object
            interface Dom {
                setInnerText: (selector: string, time: string) => void;
            }

            // Define callback for the dom object from .Net to update the time
            setModuleImports('main.js', {
                dom: {
                    setInnerText: (selector : string, time: string) => {
                        const element = document.querySelector(selector);
                        if (element) {
                            (element as HTMLElement).innerText = time;
                        }
                    }
                }
            });
        
            console.log("Dotnet script initialized");
            const config = getConfig();
        
            console.log("Dotnet script config", config);

            // Get the assembly exports to Reset and Toggle the stopwatch
            const exports = await getAssemblyExports(config.mainAssemblyName);
        
            document.getElementById('reset')!.addEventListener('click', e => {
                console.log("Resetting stopwatch");
                exports.StopwatchSample.Reset();
                e.preventDefault();
            });
        
            const pauseButton = document.getElementById('pause')!;
            pauseButton.addEventListener('click', e => {
                console.log("Toggling stopwatch");
                const isRunning = exports.StopwatchSample.Toggle();
                console.log("Stopwatch is running", isRunning);
                pauseButton.innerText = isRunning ? 'Pause' : 'Start';
                e.preventDefault();
            });
        
            // Run the main function to start the application in the UI thread
            await runMain();
        } catch (error) {
            console.error("Error loading dotnet.js", error);
        } finally {
            // Revoke the Blob URL to free up memory
            URL.revokeObjectURL(blobUrl);
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
