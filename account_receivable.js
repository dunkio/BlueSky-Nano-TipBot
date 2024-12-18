/* 
 *  the go-function:     
 *      const address = 'nano_3rxr5ixpz98cwar646da3pwxb1e4n64zfm9qtywcmc76py9tckysceohhzod';
 *      account_receivable.account_receivable(address).then(console.log);
 *
 * 
 */

// Import functions 
var post = require('./post_request');
const RPC_SERVER = 'http://127.0.0.1:7076/'; // LocalHost Live
const WORK_SERVER = 'https://rpc.nano.to/'; 
const REQUEST_TIMEOUT = 10000 * 10000; // 10 * 1000 = 10 seconds


// Only needed if you are using node js:
// You also need to npm install xmlhttprequest if you are using node js
// const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;


function account_receivable(address) {
    input = {
        action: 'accounts_receivable',
        accounts: [address],
        count: 100
    }
    return post.post(RPC_SERVER, input);
}

module.exports = {
    account_receivable: account_receivable
}

