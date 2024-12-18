// Import functions 
import {work} from "./work_request.js";
import * as process from 'process';
const RPC_SERVER = 'http://127.0.0.1:7076/'; // LocalHost Live
const WORK_SERVER = 'https://rpc.nano.to/'; 
const REQUEST_TIMEOUT = 10000 * 10000; // 10 * 1000 = 10 seconds
const API_KEY = process.env.NANO_TO_API; //k..n@web.de on rpc.nano.to

// Only needed if you are using node js:
// You also need to npm install xmlhttprequest if you are using node js
// const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;


export function work_generate(hashFromPreviousBlock) {
    const input = {
        action: 'work_generate',
        hash: hashFromPreviousBlock,
        key: API_KEY
    }
    //return work.work(WORK_SERVER, input); 
    return work(WORK_SERVER, input); 
}


