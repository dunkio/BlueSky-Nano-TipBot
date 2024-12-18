import { Bot } from "@skyware/bot";
import * as dotenv from 'dotenv';
import * as process from 'process';
import { existsUser, existsOpenTips, accepted, validateTipText, handleMessage, handleMessageNanoGPT } from "./user_interaction.mjs";
import { checkAddress, checkAmount, checkHash, convert, Unit } from "nanocurrency";
import nano from "./nano.mjs";
import * as fs from 'fs';
import { isImageRequest, extractImagePrompt, handleImageGeneration } from './image_generation.mjs';
import atprotoApi from '@atproto/api';
const { BskyAgent } = atprotoApi;

dotenv.config();

const bot = new Bot({ emitChatEvents: true });
const path = './user_account.json';
const path_open_tips = './open_tips.json';
var nanoTip = false;
let accessJwt = null;  // Store the access token
let botDid = null;  // Store the bot's DID

async function init() {
    try {
        // Login to Bluesky
        const session = await bot.login({
            identifier: process.env.BLUESKY_USERNAME_NANOGPT,
            password: process.env.BLUESKY_PASSWORD_NANOGPT,
        });
        accessJwt = session.accessJwt;  // Save the access token
        botDid = session.did;  // Store the bot's DID
        console.log('Successfully logged in to Bluesky');
        console.log('Bot DID:', botDid);

        // Handle incoming messages
        bot.on("message", async (message) => {
            const sender = await message.getSender();
            const text = message.text;
            console.log(`Received message from @${sender.handle}: ${message.text}`);

            // Get the user's account address
            const userData = JSON.parse(fs.readFileSync(path));
            const accountaddress = existsUser(sender.handle, userData) ? userData.users[sender.handle].account : null;
			const conversation = await message.getConversation();

            if (!accountaddress) {
                if (conversation) {
                    await conversation.sendMessage({ 
                        text: "Please create your account by sending tipnano.bsky.social a message first. \n You are then able to use the Nano Tip-Bot and the NanoGPT-Bot with the same account." 
                    });
                }
                return;
            } else {
				if (conversation) {
					const result = await handleMessageNanoGPT(text, sender.handle, accountaddress);
	
					if (result.success) {
						if (result.type === 'text') {
							// For text responses
							await conversation.sendMessage({ text: result.response });
	
						} else if (result.type === 'image' && result.imageData) {
							// For image responses
							await conversation.sendMessage({ text: result.response });
							// TODO: Handle image data if needed
						}
					} else {
						// For error responses
						await conversation.sendMessage({ text: result.error || "Sorry, something went wrong." });
					}
				}
			}
        });
        // Handle mentions
        bot.on("mention", async (mention) => {
            const sender = await mention.author;
            await mention.like();
            console.log("text: ", mention.text);
            
            // Get the user's account address
            const userData = JSON.parse(fs.readFileSync(path));
            const accountaddress = existsUser(sender.handle, userData) ? userData.users[sender.handle].account : null;
            
            if (!accountaddress) {
                await mention.reply({ 
                    text: "Please create your account by sending tipnano.bsky.social a message first. \n You are then able to use the Nano Tip-Bot and the NanoGPT-Bot with the same account." 
                });
                return;
            }
            
            // Check if this is an image generation request
            if (isImageRequest(mention.text)) {
                const prompt = extractImagePrompt(mention.text);
                if (!prompt) {
                    await mention.reply({ text: "Please provide a description of the image you want to generate." });
                    return;
                }

                try {
                    const result = await handleImageGeneration(prompt, accessJwt, accountaddress);
                    if (result.success) {
                        // Create direct Bluesky agent for posting
                        const agent = new BskyAgent({
                            service: 'https://bsky.social'
                        });
                        agent.session = { accessJwt };

                        // Get the mention URI and CID for reply
                        const mentionUri = mention.uri;
                        const mentionCid = mention.cid;

                        // Create post with proper reply structure
                        try {
                            console.log('Attempting to post with agent...');
                            // Get the bot's DID
                            console.log('Bot DID:', botDid);

                            // Create the record
                            const record = {
                                repo: botDid,
                                collection: 'app.bsky.feed.post',
                                record: {
                                    text: `Here's your generated image for prompt: "${prompt}"`,
                                    reply: {
                                        root: {
                                            uri: mentionUri,
                                            cid: mentionCid
                                        },
                                        parent: {
                                            uri: mentionUri,
                                            cid: mentionCid
                                        }
                                    },
                                    embed: result.embed,
                                    createdAt: new Date().toISOString()
                                }
                            };

                            console.log('Sending record:', JSON.stringify(record, null, 2));
                            const postResult = await agent.api.com.atproto.repo.createRecord(record);
                            console.log('Post successful:', postResult);
                        } catch (postError) {
                            console.error('Error posting to Bluesky:', {
                                error: postError.message,
                                stack: postError.stack,
                                response: postError.response?.data
                            });
                            throw postError;
                        }
                    } else {
                        await mention.reply({ text: "Sorry, I couldn't generate the image. Please try again later." });
                    }
                } catch (error) {
                    console.error('Error handling image generation:', error);
                    await mention.reply({ text: "Sorry, something went wrong while generating the image." });
                }
                return;

            } else {
				// Handle the message and get the result
				const result = await handleMessageNanoGPT(mention.text, sender.handle, accountaddress);
				console.log("Handler result:", result);

				if (result.success) {
					if (result.type === 'text') {
						// For text responses
						await mention.reply({ text: result.response });
						return;
					} else if (result.type === 'image' && result.imageData) {
						// For image responses
						await mention.reply({ text: result.response });
						return;
						// TODO: Handle image data if needed
					}
				} else {
					// For error responses
					await mention.reply({ text: result.error || "Sorry, something went wrong." });
					return;
				}
			}
        });

    } catch (error) {
        console.error('Error initializing bot:', error);
    }
}

init();
