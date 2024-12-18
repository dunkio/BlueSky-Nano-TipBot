// Only needed if you are using node js
// You also need to npm install xmlhttprequest if you are using node js
//const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
import { XMLHttpRequest } from "xmlhttprequest";
const RPC_SERVER = 'http://127.0.0.1:7076/'; // LocalHost Live
const WORK_SERVER = 'https://rpc.nano.to/'; 
const REQUEST_TIMEOUT = 10000 * 10000; // 10 * 1000 = 10 seconds

// Send a POST request and return a Promise
export function work(url, params) {

    return new Promise((resolve, reject) => {
        let xhttp = new XMLHttpRequest();
        xhttp.timeout = REQUEST_TIMEOUT;
        xhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                try {
                    resolve(JSON.parse(this.responseText));
                    return;
                } catch (e) {
                    console.error('Failed to parse response from node');
                    console.error(this.responseText);
                    reject(e);
                    return;
                }
            } else if (this.readyState == 4 && this.status != 200) {
                console.error('Failed to connect to ' + url);
                reject();
                return;
            }
        };
        xhttp.open("POST", url, true);
        xhttp.setRequestHeader("Content-Type", "application/json");
        xhttp.send(JSON.stringify(params));
    });
}


/* module.exports = {
    work: work
} */
/*     export default {
        work: work,
    } */

