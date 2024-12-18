import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import Atproto from '@atproto/api';
//import AtpAgent from '@atproto/api';
import sharp from 'sharp';
//import Nano from 'nanocurrency';
import nano from "./nano.mjs";
import { checkAddress, checkAmount, checkHash, convert, Unit } from "nanocurrency";

const { BskyAgent } = Atproto;
//const nano = new Nano('https://proxy.nanos.cc/proxy');

dotenv.config();

const NANOGPT_BASE_URL = "https://nano-gpt.com/api";
const NANOGPT_HEADERS = {
    "x-api-key": process.env.NANOGPT_API_KEY,
    "Content-Type": "application/json"
};

var nanoTip = false;
let tip_amount_converted;


// Convert base64 to buffer and resize if needed
async function base64ToBuffer(base64) {
    console.log('Starting base64 to buffer conversion and resizing');
    // Remove the data URL prefix if present
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    console.log(`Original buffer size: ${buffer.length} bytes`);

    // If image is larger than 900KB (leaving some margin), resize it
    if (buffer.length > 900000) {
        console.log('Image too large, resizing...');
        try {
            // Use sharp to resize the image while maintaining aspect ratio
            const resizedBuffer = await sharp(buffer)
                .resize(800, 800, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .png({ quality: 80, compressionLevel: 9 })
                .toBuffer();
            
            console.log(`Resized buffer size: ${resizedBuffer.length} bytes`);
            return resizedBuffer;
        } catch (error) {
            console.error('Error resizing image:', error);
            throw error;
        }
    }

    return buffer;
}

// Upload image to Bluesky using official API
async function uploadImageToBluesky(imageBuffer, accessJwt) {
    try {
        console.log('Starting image upload to Bluesky');
        console.log(`Image buffer size: ${imageBuffer.length} bytes`);
        
        const agent = new BskyAgent({
            service: 'https://bsky.social'
        });

        console.log('BskyAgent created');
        console.log('Setting access token...');
        // Set the access token directly
        agent.session = { accessJwt };

        // Upload the image
        console.log('Uploading image to Bluesky...');
        const { data } = await agent.uploadBlob(imageBuffer, { encoding: 'image/png' });
        console.log('Upload successful. Blob data:', JSON.stringify(data, null, 2));
        return data.blob;
    } catch (error) {
        console.error('Error uploading image to Bluesky:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            response: error.response ? {
                status: error.response.status,
                data: error.response.data
            } : 'No response data'
        });
        throw error;
    }
}

export async function generateImage(prompt, model = "flux/schnell", width = 1024, height = 1024, showExplicitContent = true) {
    console.log('=== Starting Image Generation ===');
    console.log(`Prompt: "${prompt}"`);
    console.log(`Model: ${model}, Width: ${width}, Height: ${height}`);

    const data = {
        prompt,
        model,
        width,
        height,
        showExplicitContent,
    };

    try {
        console.log('Sending request to NanoGPT API...');
        const response = await fetch(`${NANOGPT_BASE_URL}/generate-image`, {
            method: 'POST',
            headers: NANOGPT_HEADERS,
            body: JSON.stringify(data)
        });

        if (response.ok) {
            const responseJson = await response.json();
            console.log('Image generation successful');
            console.log('Response structure:', Object.keys(responseJson));
            console.log('Response data structure:', responseJson.data ? Object.keys(responseJson.data[0]) : 'No data array');
            return responseJson;
        } else {
            console.error(`Error generating image. Status code: ${response.status}`);
            console.error(`Error response: ${await response.text()}`);
            return null;
        }
    } catch (error) {
        console.error(`Exception occurred during image generation:`, error);
        console.error('Stack trace:', error.stack);
        return null;
    }
}

export function isImageRequest(text) {
    const targetPhrase = '@nanogptbot.bsky.social';
    
      // Normalize line breaks to spaces
      const normalizedText = text.replace(/\s+/g, ' ').toLowerCase(); // Replaces multiple spaces or \n with a single space
      console.log('normalizedText: ', normalizedText);
      // Extract the index of the target phrase
      const phraseIndex = normalizedText.indexOf(targetPhrase);
      console.log('phraseIndex: ', phraseIndex);
      const promptText = normalizedText.slice(phraseIndex + targetPhrase.length).trim();
      console.log('promptText: ', promptText);

    // Remove any mentions at the start of the text
    //const cleanText = text.replace(/^@[\w.]+\s+/, '').toLowerCase();
    //console.log("cleanText: ", cleanText);
    const imageKeywords = ['image', 'image:', 'generate image', 'generate', 'picture', 'generate picture'];
    
    // Check if any keyword is at the start of the cleaned text
    return imageKeywords.some(keyword => promptText.startsWith(keyword));
}

export function determineImageModel(text) {
    // Remove any mentions at the start of the text
    const cleanText = text.replace(/^@[\w.]+\s+/, '');
    const firstFiveWords = cleanText.toLowerCase().split(/\s+/).slice(0, 5);
    
    if (firstFiveWords.includes('recraft')) {
        return 'recraft-v3';
    }
    
    // Default model
    return 'flux/schnell';
}

export function extractImagePrompt(text) {
    console.log('Extracting image prompt from:', text);
    const targetPhrase = '@nanogptbot.bsky.social';
    
    // Check if the text contains the phrase
    // if (text.includes(targetPhrase)) {

      // Normalize line breaks to spaces
      const normalizedText = text.replace(/\s+/g, ' ').toLowerCase(); // Replaces multiple spaces or \n with a single space
    //   console.log('normalizedText: ', normalizedText);
      // Extract the index of the target phrase
      const phraseIndex = normalizedText.indexOf(targetPhrase);
    //   console.log('phraseIndex: ', phraseIndex);
      const promptText = normalizedText.slice(phraseIndex + targetPhrase.length).trim();
    //   console.log('promptText: ', promptText);

      // Split the text starting from where the target phrase ends
      //const parts = normalizedText.slice(phraseIndex + targetPhrase.length).trim().split(' ');
    
    // // Remove any mentions at the start of the text
    // const cleanText = text.replace(/^@[\w.]+\s+/, '');
    // const lowercaseText = cleanText.toLowerCase();
    
    // List of prefixes to remove
    const prefixes = ['image', 'image:', 'generate image', 'generate', 'picture', 'generate picture'];
        // Find the matching prefix
        const matchedPrefix = prefixes.find(prefix => promptText.startsWith(prefix));
    
    // Remove the prefix if found, otherwise just trim the text
    const prompt = matchedPrefix 
        ? promptText.slice(matchedPrefix.length).trim() 
        : promptText.trim();
        
    console.log('Extracted prompt:', prompt);
    return prompt;
}

export async function handleImageGeneration(prompt, accessJwt, accountaddress) {
    console.log('\n=== Starting Image Generation Handler ===');
    console.log(`Original prompt: "${prompt}"`);
    
    try {
        // Determine which model to use and required balance
        const model = determineImageModel(prompt);
        const requiredBalance = model === 'recraft-v3' ? 0.10 : 0.03; // 0.10 for recraft, 0.03 for regular
        console.log(`Selected model: ${model}, Required balance: ${requiredBalance} NANO`);
        
        // Check user's balance
        const balance = await nano.balance(accountaddress);
        if (balance.balance < requiredBalance) {
            throw new Error(`Insufficient balance. Required: ${requiredBalance} NANO, Current: ${balance.balance} NANO`);
        }

        // Generate the image with the selected model
        console.log('\n1. Generating image...');
        const result = await generateImage(prompt, model);
        console.log('Generation result structure:', Object.keys(result || {}));
        
        if (!result || !result.data || !result.data[0] || !result.data[0].b64_json) {
            console.error('Invalid generation result structure:', JSON.stringify(result, null, 2));
            return {
                success: false,
                error: 'Failed to generate image'
            };
        }

        // Convert base64 to buffer and handle resizing if needed
        console.log('\n2. Processing image...');
        const imageBuffer = await base64ToBuffer(result.data[0].b64_json);

        // If we have an access token, upload to Bluesky
        if (accessJwt) {
            console.log('\n3. Uploading to Bluesky...');
            const blob = await uploadImageToBluesky(imageBuffer, accessJwt);
            
            // Send the payment transaction
            const destination = "nano_1gg5pej9xawucnnztgwnekxc9wm8xjnph18rrmu35mqsnu6wnrjn88s8qtr9";
            tip_amount_converted = convert(result.cost.toString(), { from: Unit.Nano, to: Unit.raw, });
            const block = await nano.send(destination, accountaddress, tip_amount_converted, nanoTip);
            console.log('Payment transaction completed:', block);
            
            return {
                success: true,
                imageData: result.data[0].b64_json,
                blob,
                embed: {
                    $type: 'app.bsky.embed.images',
                    images: [{
                        alt: prompt,
                        image: blob
                    }]
                },
                transaction: block
            };
        }

        // If no access token, just return the image data
        return {
            success: true,
            imageData: result.data[0].b64_json
        };

    } catch (error) {
        console.error('Error in handleImageGeneration:', error);
        return {
            success: false,
            error: error.message || 'Unknown error occurred'
        };
    }
}
