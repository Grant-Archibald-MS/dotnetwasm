function startWorker(workerScript) {
    if (typeof(Worker) !== "undefined") {
        let worker = new Worker(workerScript);
        worker.onmessage = function(event) {
            console.log("Worker message received:", event.data);
            if (event.data === "ready") {
                document.getElementById('reset').disabled = false;
            }
        };
        return worker;
    } else {
        console.log("Sorry, your browser does not support Web Workers...");
        return null;
    }
}

var worker1 = startWorker('./worker.js?v=1.0');
worker1.postMessage({type:'start'})

document.getElementById('reset').addEventListener('click', e => {
    worker1.postMessage('reset')
    e.preventDefault();
});