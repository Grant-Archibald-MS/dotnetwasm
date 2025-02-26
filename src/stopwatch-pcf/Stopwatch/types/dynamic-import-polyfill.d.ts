declare module 'dynamic-import-polyfill' {
    interface DynamicImportPolyfillOptions {
      modulePath?: string;
      importFunctionName?: string;
    }
  
    function initialize(options?: DynamicImportPolyfillOptions): void;
  
    export { initialize };
  }