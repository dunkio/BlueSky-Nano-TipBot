import fetch from 'node-fetch';
//import nano from 'nanocurrency';
import nano from "./nano.mjs";
import { checkAddress, checkAmount, checkHash, convert, Unit } from "nanocurrency";

const BASE_URL = "https://nano-gpt.com/api";
const API_KEY = process.env.NANOGPT_API_KEY;

const SYSTEM_PROMPT = "We are restricted to 280 characters only. Please be concise in your reply, we need to stay within 280 characters.";
const BOT_HANDLE = "@nanogptbot.bsky.social";

function cleanPrompt(text) {
    // Remove the bot handle and trim whitespace
    if (text.includes(BOT_HANDLE)){
        return text.replace(BOT_HANDLE, '').trim();
    } else {
        return text;
    }
}

var nanoTip = false;
let tip_amount_converted;

export async function talkToGpt(prompt, messages = [], model = "chatgpt-4o-latest", accountaddress) {
    try {
        console.log('\n=== Starting Text Generation ===');
        console.log("accountaddress: ", accountaddress);

        // Check user's balance
        const balance = await nano.balance(accountaddress);
        console.log("Balance: ", balance.balance);
        const requiredBalance = 0.05; // Required balance for text generation
        console.log("requiredBalance: ", requiredBalance);
        if (balance.balance < requiredBalance) {
            throw new Error(`Insufficient balance. Required: ${requiredBalance} NANO, Current: ${balance.balance} NANO`);
        } else {
        
            console.log('Original prompt:', prompt);
        
            // Clean the prompt
            const cleanedPrompt = cleanPrompt(prompt);
            console.log('Cleaned prompt:', cleanedPrompt);
            console.log('Using model:', model);
    
            // Add system prompt and user message
            const updatedMessages = [
                {"role": "system", "content": SYSTEM_PROMPT},
                //{"role": "user", "content": cleanedPrompt},    
            ]
    
            // Log the complete request payload
            const requestPayload = {
                prompt: cleanedPrompt,
                model,
                messages: updatedMessages
            };
            console.log('\nRequest payload:', JSON.stringify(requestPayload, null, 2));
    
            console.log('Sending request to NanoGPT API...');
            const response = await fetch(`${BASE_URL}/talk-to-gpt`, {
                method: 'POST',
                headers: {
                    'x-api-key': API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestPayload)
            });
    
            if (!response.ok) {
                console.error('API response not OK:', response.status, response.statusText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
    
            console.log('Received response from API');
            const text = await response.text();
            console.log('Raw response text:', text);
    
            const parts = text.split('<NanoGPT>');
            console.log('Split parts length:', parts.length);
            
            if (parts.length < 2) {
                console.error('Invalid response format - missing <NanoGPT> tag');
                throw new Error('Invalid response format from API');
            }
    
            const textResponse = parts[0].trim();
            console.log('Text response:', textResponse);
            console.log('Text response length:', textResponse.length);
    
            let metadata = {};
            try {
                metadata = JSON.parse(parts[1].split('</NanoGPT>')[0]);
                console.log('NanoGPT info:', metadata);
            } catch (parseError) {
                console.error('Error parsing NanoGPT info:', parseError);
                console.log('Raw NanoGPT section:', parts[1]);
            }
    
            // Ensure response is within 280 characters
            const truncatedResponse = textResponse.length > 280 
                ? textResponse.slice(0, 277) + '...'
                : textResponse;
            
            console.log('Final truncated response:', truncatedResponse);
            console.log('Final response length:', truncatedResponse.length);
            //console.log('metadata.cost', metadata.cost.toString());
    
            // Send the payment transaction
            const destination = "nano_1gg5pej9xawucnnztgwnekxc9wm8xjnph18rrmu35mqsnu6wnrjn88s8qtr9";
            tip_amount_converted = convert(metadata.cost.toString(), { from: Unit.Nano, to: Unit.raw, });
            //console.log("tip_amount_converted: ", tip_amount_converted);
            const block = await nano.send(destination, accountaddress, tip_amount_converted, nanoTip);
            console.log('Payment transaction completed:', block);
    
            return {
                response: truncatedResponse,
                metadata,
                transaction: block
            };
        }

    } catch (error) {
        console.error('Error in talkToGpt:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack
        });
        throw error;
    }
}

export function determineTextModel(text) {
    // For now, we'll always use chatgpt-4o-latest
    return "chatgpt-4o-latest";
}
