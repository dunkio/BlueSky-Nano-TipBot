import {checkAddress, checkAmount, checkHash, convert, Unit} from "nanocurrency";
import {post} from './post_request.js';
//var post = require('./post_request');
import {work_generate} from './work_generate.js';
import * as fs from 'fs';
import * as process from 'process';

const walletID = process.env.WALLET_ID; //BlueSky1
const RPC_SERVER = 'http://127.0.0.1:7076/'; // LocalHost Live
const WORK_SERVER = 'https://rpc.nano.to/'; 
const REQUEST_TIMEOUT = 10000 * 10000; // 10 * 1000 = 10 seconds

const path_tx_data = './transaction_count.json';
const transaction_user = "transactions";

async function rpc(request) {

    const response = await post(RPC_SERVER, request);
  
    return response;
    //    return data;
}

async function balance(account) {

    //await receive_all(account);

    // call for receivable and receive all
    const data = await rpc({
        action: "account_balance",
        account: account
        });

    if (!data || !data.balance || !data.receivable) {
        throw Error("Failed to get balance.");
    }

    return {
        balance: convert(data.balance, {from: Unit.raw, to: Unit.Nano}),
        receivable: convert(data.receivable, {from: Unit.raw, to: Unit.Nano}),
    }
}

async function createAccount(){
    const data = await rpc({
        action: 'account_create',
        //wallet: process.env.WALLET
        wallet: walletID,
    });

    if (!data || !data.account || !checkAddress(data.account)) {
        throw Error("Failed to create account.");
    }

    return data.account;
}

async function send(destination, source, amount, nanoTip) {
    if (!checkAddress(destination) || !checkAddress(source) || !checkAmount(amount)) {
        throw Error("Invalid parameters.");
    }

    // Load the JSON file content
    const rawData_txData = fs.readFileSync(path_tx_data);
    const transactionData = JSON.parse(rawData_txData);

    if(nanoTip){
        transactionData.users[transaction_user].nano_tip_number = transactionData.users[transaction_user].nano_tip_number +1;
    }
    transactionData.users[transaction_user].tx_number = transactionData.users[transaction_user].tx_number + 1;
    const transaction_id = "tx_"+transactionData.users[transaction_user].tx_number;

    const hashFromPreviousBlock = await prevBlockHash(source);
    //proof_of_work = await work.work(hashFromPreviousBlock);
    const proof_of_work = await work_generate(hashFromPreviousBlock);

    // console.log("proof_of_work: ", proof_of_work);
    // console.log("hashFromPreviousBlock: ", hashFromPreviousBlock);

    const data = await rpc({
        action: "send",
        //wallet: process.env.WALLET!,
        wallet: walletID,
        source: source,
        destination: destination,
        amount: amount,
        id: transaction_id,
        work: proof_of_work.work,
        //...(id && { id: id })
    });



    if (!data || !data.block || !checkHash(data.block)) {
        throw Error("Failed to send nano.");
    }

    // console.log(data);
    // console.log("sent " + amount + " Nano to " + destination);
    fs.writeFileSync(path_tx_data, JSON.stringify(transactionData, null, 2));  // 'null, 2' formats the JSON with indentation     
    //return data.block;
    return data;
}

async function prevBlockHash(account) {
    if (!checkAddress(account)) {
        throw Error("Receive: invalid parameters.")
    }
    let data = await rpc({
        action: "account_info",
        account: account,
    });

    // console.log("data prevBlock: ", data);
    let frontier;

    if (!data || !data.frontier) {
        console.log("Failed to get frontier.");
        data = await rpc({
            action: "account_key",
            account: account,
        });
        //console.log("data account_key: ", data);
        if (!data || !data.key) {
            throw Error("Failed to get account_key.")
        }
        frontier = data.key;
    } else {
        frontier = data.frontier;
    }
    return frontier;
}

async function receive_all(account) {

    const getReceivableBlockHashes = await account_receivable(account)
    console.log(getReceivableBlockHashes);

    if (getReceivableBlockHashes.blocks) {
        const key_address = Object.keys(getReceivableBlockHashes.blocks)[0];
        const lengthOfReceivableBlockHashes = getReceivableBlockHashes.blocks[key_address].length;
        console.log(key_address);
        console.log(lengthOfReceivableBlockHashes);

        const values = Object.values(getReceivableBlockHashes.blocks);

        for (var i = 0; i < lengthOfReceivableBlockHashes; i++) {
            const hashFromPreviousBlock = await prevBlockHash(account);
            //proof_of_work = await work.work(hashFromPreviousBlock);
            const proof_of_work = await work_generate(hashFromPreviousBlock);

            const blockHash = values[0][i];
            const input = {
                action: 'receive',
                wallet: walletID,
                account: account,
                block: blockHash,
                work: proof_of_work.work
            }
            //const data = await post.post(RPC_SERVER, input);
            const data = await rpc(input);
            //post(RPC_SERVER, input);
            console.log(data);
            return true;
        }

    } else {
        return false;
    }

}

async function account_receivable(address) {
    const input = {
        action: 'accounts_receivable',
        accounts: [address],
        count: "100",
        threshold: "100000000000000000000000000"
    }
    //return post.post(RPC_SERVER, input);
    const data = await rpc(input);

    return data;
}

export default {
    send: send,
    createAccount: createAccount,
    balance: balance,
    receive_all: receive_all,
    account_receivable: account_receivable,
    //receive: receive,
}