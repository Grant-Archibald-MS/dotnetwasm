import { IInputs, IOutputs } from "./generated/ManifestTypes";

export class Stopwatch implements ComponentFramework.StandardControl<IInputs, IOutputs> {

    private container: HTMLDivElement;
    private _context: ComponentFramework.Context<IInputs>

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

        // Query the record with name 'dotnet.js.gz' in the 'dev_name' field
        const query = "?$filter=dev_name eq 'dotnet.js.gz'";
        this._context.webAPI.retrieveMultipleRecords("dev_webassembly", query)
            .then((result) => {
                if (result.entities.length > 0) {
                    // Record found, proceed to retrieve the dev_content column
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const id = result.entities[0]["dev_webassemblyid"];
                    this.fetchFileContent(id);
                } else {
                    console.log("No record found with the specified name.");
                }
            })
            .catch((error) => {
                console.error(error.message);
            });
    }

    private fetchFileContent(fileIdentifier: string): void {
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
            this.decompressFileContent(fileContent);
        })
        .catch(error => {
            console.error(error.message);
        });
    }

    private async decompressFileContent(fileContent: string): Promise<void> {
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
        const decompressedTextContent = await decompressedBlob.text();
       
        // Create a JSON Blob with the correct MIME type
        const jsonBlob = new Blob([decompressedTextContent], { type: 'application/javascript' });  

        // Create a URL for the JSON Blob and pass it to loadDotnetJs
        await this.loadDotnetJs(URL.createObjectURL(jsonBlob));
    }

    private loadHtmlContent(): void {
        const htmlContent = `
            <div id="control-container">
                <button id="reset" style="color:red">Reset</button>
                <button id="pause" style="color:green">Pause</button>
                <div id="output"></div>
            </div>
        `;
        this.container.innerHTML = htmlContent;
    }

    private async loadDotnetJs(blobUrl: string): Promise<void> {    
        try {
            const module = await import(/* webpackIgnore: true */ blobUrl);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (typeof module.dotnet === "undefined") {
                console.error("Dotnet instance is undefined");
                return;
            }
        
            const { getAssemblyExports, getConfig, runMain } = module.dotnet
                .withApplicationArguments("start")
                .create();
        
            console.log("Dotnet script initialized");
            const config = getConfig();
        
            console.log("Dotnet script config", config);
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
