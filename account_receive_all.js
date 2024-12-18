// Import functions 
var post = require('./post_request');
var account_receivable = require('./account_receivable');
const RPC_SERVER = 'http://127.0.0.1:7076/'; // LocalHost Live
const WORK_SERVER = 'https://rpc.nano.to/'; 
const REQUEST_TIMEOUT = 10000 * 10000; // 10 * 1000 = 10 seconds


async function receive(address, walletID) {

    const getReceivableBlockHashes = await account_receivable.account_receivable(address)
    console.log(getReceivableBlockHashes);

    if (getReceivableBlockHashes.blocks) {
        const key_address = Object.keys(getReceivableBlockHashes.blocks)[0];
        const lengthOfReceivableBlockHashes = getReceivableBlockHashes.blocks[key_address].length;
        console.log(key_address);
        console.log(lengthOfReceivableBlockHashes);

        const values = Object.values(getReceivableBlockHashes.blocks);

        for (var i = 0; i < lengthOfReceivableBlockHashes; i++) {

            const blockHash = values[0][i];
            input = {
                action: 'receive',
                wallet: walletID,
                account: address,
                block: blockHash
            }
            const confHash = await post.post(RPC_SERVER, input);
            console.log(confHash);
        }

    }

}

module.exports = {
    receive_all : receive
}

