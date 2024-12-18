import { Bot } from "@skyware/bot";
import * as dotenv from 'dotenv';
import * as process from 'process';
import { existsUser,existsOpenTips, accepted, validateTipText, handleMessage} from "./user_interaction.mjs";
import {checkAddress, checkAmount, checkHash, convert, Unit} from "nanocurrency";
import nano from "./nano.mjs";
import * as fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Path to the JSON file
//const path_open_tips = './open_tips.json';

// Get the directory of the current script
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Construct the absolute path to 'open_tips.json'
const path_open_tips = join(__dirname, 'open_tips.json');
const path_giveaway = join(__dirname, 'giveaway_account.json');


// Helper function to calculate date difference
function isOlderThan7Days(dateString) {
    const tipDate = new Date(dateString);
    const today = new Date();
    const diffInMs = today - tipDate;
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

    return diffInDays > 7;
}


// Your custom function to call for older tips
function handleOlderTip(fromAccount, amount) {
    console.log(`Calling another function for fromAccount: ${fromAccount}, amount: ${amount}`);
    // Add your custom implementation here
}

// Main function to process the JSON data
async function processJson() {
    try {
        // Read the JSON file
        const rawDataOpenTips = fs.readFileSync(path_open_tips);
        const openTips = JSON.parse(rawDataOpenTips);

        const users = openTips.users;

        for (const username in users) {
            const user = users[username];

            if (user.TipsNotAccepted) {
                const updatedTips = [];

                for (const tip of user.TipsNotAccepted) {
                    if (isOlderThan7Days(tip.dateOfTip)) {
                        console.log(`Returning tip from ${tip.fromAccount} with amount ${tip.amount}`);
                        try {
                            const nanoTip = false;
                            const sendblock_hash = await nano.send(tip.fromAccount, user.account, tip.amount, nanoTip);
                            console.log("Hash: ", sendblock_hash);
                            if (!sendblock_hash) {
                                // Keep the tip in the list if sending failed
                                updatedTips.push(tip);
                            }
                        } catch (error) {
                            console.log("Error returning the tip:", error);
                            // Keep the tip in the list in case of an error
                            updatedTips.push(tip);
                        }
                    } else {
                        // Tip is not older than 7 days, keep it in the list
                        updatedTips.push(tip);
                    }
                }

                // Update the user's TipsNotAccepted array with the filtered tips
                user.TipsNotAccepted = updatedTips;
            }
        }

        // Save the updated JSON to the file
        fs.writeFileSync(path_open_tips, JSON.stringify(openTips, null, 4), 'utf8');
        console.log('JSON file successfully updated.');
    } catch (error) {
        console.error('Error processing JSON:', error);
    }
}

// Run the main function
processJson();