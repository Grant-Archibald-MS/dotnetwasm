import { IInputs, IOutputs } from "./generated/ManifestTypes";
import { initialize } from 'dynamic-import-polyfill';



export class Stopwatch implements ComponentFramework.StandardControl<IInputs, IOutputs> {

    private container: HTMLDivElement;

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
        const webResourceUrl = context.parameters.webResourceUrl.raw;

        if (!webResourceUrl) {
            console.error("No web resource URL provided");
            return;
        }

        initialize({
            modulePath: webResourceUrl, // Adjust the path as needed
            importFunctionName: '__import__' // Adjust the function name as needed
          });
       
        console.log(`Base path is ${webResourceUrl}`);

        if (webResourceUrl !== null && webResourceUrl !== "") {
            this.loadHtmlContent();
            this.loadDotnetJs(webResourceUrl);
        } else {
            console.error("No web resource name provided");
        }
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

    private async loadDotnetJs(webResourceUrl: string): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const windowInstance = window as any;
        const module = await windowInstance.__import__(webResourceUrl);

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
