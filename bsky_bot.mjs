// https://skyware.js.org/guides/bot/introduction/listening-to-events/

import { Bot } from "@skyware/bot";
import * as dotenv from 'dotenv';
import * as process from 'process';
import { existsUser, existsOpenTips, accepted, validateTipText, handleMessage } from "./user_interaction.mjs";
import { checkAddress, checkAmount, checkHash, convert, Unit } from "nanocurrency";
import nano from "./nano.mjs";
import * as fs from 'fs';
import atprotoApi from '@atproto/api';
const { BskyAgent } = atprotoApi;

dotenv.config();

let accessJwt = null;  // Store the access token
let botDid = null;  // Store the bot's DID

const bot = new Bot({ emitChatEvents: true });

const session = await bot.login({
	identifier: process.env.BLUESKY_USERNAME,
	password: process.env.BLUESKY_PASSWORD,
});
accessJwt = session.accessJwt;  // Save the access token
botDid = session.did;  // Store the bot's DID
console.log('Successfully logged in to Bluesky');
console.log('Bot DID:', botDid);

const path = './user_account.json';
const path_open_tips = './open_tips.json';
const path_giveaway = './giveaway_account.json';
const xno_price_path = './xno_price.json';
const giveawayAccount = "nano_3w1w164onyhjfurru7faoqpjssgwigcyut8z3k98megobcb4xhc88mp9e9ze";

var nanoTip = false;


bot.on("message", async (message) => {
	const sender = await message.getSender();
	const text = message.text;
	console.log(`Received message from @${sender.handle}: ${message.text}`);

	const result = await handleMessage(text, sender.handle, accessJwt, botDid);

	const conversation = await message.getConversation();
	if (conversation) {
		//console.log(`found conversation, answer: ` + answer);
		// It may not always be possible to resolve the conversation the message was sent in!
		await conversation.sendMessage({ text: result[0] });
		//await conversation.sendMessage({ text: result.answerText });
		if (result[1] != "Error") {
			await conversation.sendMessage({ text: result[1] });
		}
	}
});


bot.on("mention", async (mention) => {
	const sender = await mention.author;
	await mention.like();
	console.log("text: ", mention.text);
	console.log("tipper: ", sender.handle);
	const tipper = sender.handle;
	const result_validateTipText = validateTipText(mention.text);
	// if(result_validateTipText.type === "tip"){
	// 	//ToDo
	// }
	let tip_amount;
	let tipped_user;
	// let tip_amount = result_validateTipText.tip_amount;
	// let tipped_user = result_validateTipText.tipped_user;
	let result_account_balance;
	let account_balance;
	let tip_amount_converted;
	let tipped_user_account;
	let trx_block_hash;
	let tipValue;

	// check if the message is to tip someone
	if (result_validateTipText.tipping) {
		tip_amount = result_validateTipText.tipAmount;
		tipped_user = result_validateTipText.tippedUser;

		if (tip_amount != null) {
			// Load the JSON file content
			const rawData = fs.readFileSync(path);
			const userData = JSON.parse(rawData);


			if (!existsUser(tipper, userData)) {
				await mention.reply({ text: "You first need to send me a private message to create your account." });
				/* 		  } else if (!accepted(tipper, userData)){
							await mention.reply({ text: "You first need to send me a private message to create your account." });	 */
			} else {
				const tipper_account = userData.users[tipper].account;

				result_account_balance = await nano.balance(tipper_account)
				account_balance = result_account_balance.balance;
				nanoTip = true;

				console.log("account_balance: ", account_balance);
				console.log("tip_amount: ", tip_amount);

				// if tipper has enough balance, change the account balance
				if (parseFloat(account_balance) >= parseFloat(tip_amount)) {

					try {
						tip_amount_converted = convert(tip_amount, { from: Unit.Nano, to: Unit.raw, });

						const xnoPriceData = fs.readFileSync(xno_price_path);
						const xno_price = JSON.parse(xnoPriceData);
						const xnoPrice = xno_price.price;

						if (!existsUser(tipped_user, userData)) {

							const rawDataOpenTips = fs.readFileSync(path_open_tips);
							const openTips = JSON.parse(rawDataOpenTips);

							const currentDate = new Date();
							const formattedDate = currentDate.toISOString().split('T')[0]; // Gives "yyyy-mm-dd"

							if (!existsOpenTips(tipped_user, openTips)) {
								// If the username doesn't exist, add it
								tipped_user_account = await nano.createAccount();
								if (tipped_user_account) {
									await nano.receive_all(tipper_account);
									trx_block_hash = await nano.send(tipped_user_account, tipper_account, tip_amount_converted, nanoTip);
									if (trx_block_hash.block) {
										openTips.users[tipped_user] = {
											"account": tipped_user_account,
											"TipsNotAccepted": []
										};
										console.log(`User '${tipped_user}' added.`);
										openTips.users[tipped_user].TipsNotAccepted.push({
											"dateOfTip": formattedDate,
											"fromAccount": tipper_account,
											"amount": tip_amount_converted
										});
										// Save the updated data back to the JSON file
										fs.writeFileSync(path_open_tips, JSON.stringify(openTips, null, 2));  // 'null, 2' formats the JSON with indentation

										tipValue = xnoPrice * parseFloat(tip_amount);
										tipValue = parseFloat(tipValue.toFixed(2));

										await mention.reply({
											text: `${tip_amount} Nano (~ ${tipValue} USD) tipped to ${tipped_user}. 
												\n${tipped_user}, send me a message to accept the Nano-Tip within the next 7 days.
											\nNano is a feeless, instant and energy-efficient digital currency. More on nanocurrency.bsky.social`
										});
									} else {
										await mention.reply({ text: `There was a problem, please try again.` });
									}
								}
							} else {
								tipped_user_account = openTips.users[tipped_user].account;
								await nano.receive_all(tipper_account);
								trx_block_hash = await nano.send(tipped_user_account, tipper_account, tip_amount_converted, nanoTip);
								if (trx_block_hash.block) {

									openTips.users[tipped_user].TipsNotAccepted.push({
										"dateOfTip": formattedDate,
										"fromAccount": tipper_account,
										"amount": tip_amount_converted
									});
									// Save the updated data back to the JSON file
									fs.writeFileSync(path_open_tips, JSON.stringify(openTips, null, 2));  // 'null, 2' formats the JSON with indentation

									tipValue = xnoPrice * parseFloat(tip_amount);
									tipValue = parseFloat(tipValue.toFixed(2));

									await mention.reply({
										text: `${tip_amount} Nano (~ ${tipValue} USD) tipped to ${tipped_user}. 
											\n${tipped_user}, send me a message to accept the Nano-Tip within the next 7 days.
											\nNano is a feeless, instant and energy-efficient digital currency. More on nanocurrency.bsky.social`

									});
								} else {
									await mention.reply({ text: `There was a problem, please try again.` });
								}
							}

							// if there is a known user already
						} else {
							tipped_user_account = userData.users[tipped_user].account;
							await nano.receive_all(tipper_account);
							//tip_amount_converted = convert(tip_amount, {from: Unit.Nano, to: Unit.raw,});
							trx_block_hash = await nano.send(tipped_user_account, tipper_account, tip_amount_converted, nanoTip);
							if (trx_block_hash.block) {
								tipValue = xnoPrice * parseFloat(tip_amount);
								tipValue = parseFloat(tipValue.toFixed(2));
								await mention.reply({ text: `${tip_amount} Nano (~ ${tipValue} USD) tipped to ${tipped_user}` });
							} else {
								await mention.reply({ text: `There was a problem, please try again.` });
							}
						}
					} catch (error) {
						// Handle any errors that occur
						console.error("An error occurred:", error.message);
						//answerText = "Invalid amount";
					}

				} else {
					await mention.reply({ text: "Not enough Nano in your account for this tip!" });
				}
			}
		} else {
			//console.log("not validated");
			await mention.reply({ text: "I wasn't able to understand your prompt. Please tip at least 0.01 Nano and use the pattern: @tipnano.bsky.social tip-amount @username.bsky.social" });
		};


		// check if the message is to start a giveaway
	} else if (result_validateTipText.giveaway) {
		tip_amount = result_validateTipText.tipAmount;
		await mention.reply({ text: "To start a giveaway write me a message." });
		console.log("tip_amount_giveaway: ", tip_amount);

		// check if the amount is to small
	} else if (result_validateTipText.tipToSmall) {
		await mention.reply({ text: "The tip needs to be at least 0.01 Nano." });

		// check if there is another error
	} else if (result_validateTipText.targetNotFound) {
		await mention.reply({ text: "Couldn't understand your prompt." });
	}

});

bot.on("repost", async (repost) => {
	//const sender = await repost.user;
	//await repost.like();
	//console.log(repost);
	console.log("uri1: ", repost.post.uri);
	console.log("cid: ", repost.post.cid);
	console.log("uri2: ", repost.uri);
	console.log("handle: ", repost.user.handle);
	// console.log("repostCount: ", repost.post.repostCount); // this always gives back 1..
	const postUri = repost.post.uri;
	const postCid = repost.post.cid;
	const repostUri = repost.uri;
	const repostHandle = repost.user.handle;
	// const repostCount = repost.post.repostCount
	let repostHandle_account;
	let replyText;
	let trx_block_hash;
	let tipValue;
	let startedGiveaway;
	let newRepostCount;

	// Load the JSON file content
	const rawDataGiveaway = fs.readFileSync(path_giveaway);
	const giveawayData = JSON.parse(rawDataGiveaway);

	// Iterate over each giveaway entry in the JSON data
	// for (const startedGiveaway of giveawayData.giveaways) {
	// console.log("startedGiveaway_uri: ", startedGiveaway.uri);
	// console.log("postUri: ", postUri);
	// if(startedGiveaway.uri === postUri){

	// }
	let index = -1; // Initialize the index to -1 (indicating "not found")
	for (let i = 0; i < giveawayData.giveaways.length; i++) {
		startedGiveaway = giveawayData.giveaways[i]; // Current item in the array
		console.log("startedGiveaway_uri: ", startedGiveaway.uri);
		console.log("postUri: ", postUri);
		if (startedGiveaway.uri === postUri) {
			console.log("uri = uriindex = ", i);
			index = i; // Save the index of the matching item
			break;     // Exit the loop once a match is found
		}
	}
	//}
	// let index = giveawayData.giveaways.findIndex(startedGiveaway => startedGiveaway.uri === postUri);
	if (index !== -1) {
		console.log("uri = uri");
		// If there's a match, add its possible_reposts to the results
		const possibleReposts = giveawayData.giveaways[index].possible_reposts;
		const repostCount = giveawayData.giveaways[index].reposts_count;

		if (possibleReposts > repostCount) {

			let foundHandle = false;
			for (const repostedBy of giveawayData.giveaways[index].reposted_by) {

				if (repostedBy.repost_handle === repostHandle) {
					foundHandle = true;
					console.log("foundHandle: true");
					break;
				}
			}
			if (!foundHandle) {
				console.log("foundHandle: false");
				// Load the JSON file content
				const rawData = fs.readFileSync(path);
				const userData = JSON.parse(rawData);

				// If we have an access token, upload to Bluesky
				if (accessJwt) {

					console.log('\nUploading to Bluesky...');
					// const blob = await uploadRepostResponse(accessJwt);
					const agent = new BskyAgent({
						service: 'https://bsky.social'
					});

					console.log('BskyAgent created');
					console.log('Setting access token...');
					// Set the access token directly
					agent.session = { accessJwt };
					nanoTip = true;
					const giveawayAmmount = "0.05";
					const giveawayAmmount_converted = convert(giveawayAmmount, { from: Unit.Nano, to: Unit.raw, });

					const xnoPriceData = fs.readFileSync(xno_price_path);
					const xno_price = JSON.parse(xnoPriceData);
					const xnoPrice = xno_price.price;

					if (!existsUser(repostHandle, userData)) {

						const rawDataOpenTips = fs.readFileSync(path_open_tips);
						const openTips = JSON.parse(rawDataOpenTips);

						const currentDate = new Date();
						const formattedDate = currentDate.toISOString().split('T')[0]; // Gives "yyyy-mm-dd"

						if (!existsOpenTips(repostHandle, openTips)) {
							// If the username doesn't exist, add it
							repostHandle_account = await nano.createAccount();
							if (repostHandle_account) {
								await nano.receive_all(giveawayAccount);
								trx_block_hash = await nano.send(repostHandle_account, giveawayAccount, giveawayAmmount_converted, nanoTip);
								if (trx_block_hash.block) {
									openTips.users[repostHandle] = {
										"account": repostHandle_account,
										"TipsNotAccepted": []
									};
									console.log(`User '${repostHandle}' added.`);
									openTips.users[repostHandle].TipsNotAccepted.push({
										"dateOfTip": formattedDate,
										"fromAccount": giveawayAccount,
										"amount": giveawayAmmount_converted
									});

									giveawayData.giveaways[index].reposted_by.push({
										"repost_handle": repostHandle
									});
									newRepostCount = giveawayData.giveaways[index].reposts_count + 1;
									giveawayData.giveaways[index].reposts_count = newRepostCount;
									// Save the updated data back to the JSON file
									fs.writeFileSync(path_open_tips, JSON.stringify(openTips, null, 2));
									fs.writeFileSync(path_giveaway, JSON.stringify(giveawayData, null, 2));

									// tipValue = xnoPrice * parseFloat(giveawayAmmount);
									// (worth ${tipValue} USD)

									replyText`${giveawayAmmount} Nano sent to @${repostHandle}. 
											\n${repostHandle}, send me a private message to accept the Nano within the next seven days.
										\nNano is a feeless, instant and energy-efficient digital currency. More information on nanocurrency.bsky.social`;
								} else {
									replyText = `There was a problem.`;
								}
							}
						} else {
							repostHandle_account = openTips.users[repostHandle].account;
							await nano.receive_all(giveawayAccount);
							trx_block_hash = await nano.send(repostHandle_account, giveawayAccount, giveawayAmmount_converted, nanoTip);
							if (trx_block_hash.block) {

								openTips.users[repostHandle].TipsNotAccepted.push({
									"dateOfTip": formattedDate,
									"fromAccount": giveawayAccount,
									"amount": giveawayAmmount_converted
								});

								giveawayData.giveaways[index].reposted_by.push({
									"repost_handle": repostHandle
								});
								newRepostCount = giveawayData.giveaways[index].reposts_count + 1;
								giveawayData.giveaways[index].reposts_count = newRepostCount;
								// Save the updated data back to the JSON file
								fs.writeFileSync(path_open_tips, JSON.stringify(openTips, null, 2));
								fs.writeFileSync(path_giveaway, JSON.stringify(giveawayData, null, 2));

								// tipValue = xnoPrice * parseFloat(giveawayAmmount);
								// (worth ${tipValue} USD)

								replyText = `${giveawayAmmount} Nano sent to @${repostHandle}. 
										\n${repostHandle}, send me a private message to accept the Nano within the next seven days.
										\nNano is a feeless, instant and energy-efficient digital currency. More information on nanocurrency.bsky.social`;
							} else {
								replyText = `There was a problem.`;
							}
						}


						// if there is a known user already
					} else {
						repostHandle_account = userData.users[repostHandle].account;
						await nano.receive_all(giveawayAccount);
						//tip_amount_converted = convert(tip_amount, {from: Unit.Nano, to: Unit.raw,});
						trx_block_hash = await nano.send(repostHandle_account, giveawayAccount, giveawayAmmount_converted, nanoTip);
						if (trx_block_hash.block) {

							giveawayData.giveaways[index].reposted_by.push({
								"repost_handle": repostHandle
							});
							newRepostCount = giveawayData.giveaways[index].reposts_count + 1;
							giveawayData.giveaways[index].reposts_count = newRepostCount;
							fs.writeFileSync(path_giveaway, JSON.stringify(giveawayData, null, 2));

							// tipValue = xnoPrice * parseFloat(giveawayAmmount);
							// (worth ${tipValue} USD) 

							replyText = `${giveawayAmmount} Nano sent to @${repostHandle}`;
						} else {
							replyText = `There was a problem.`;
						}
					}

					if (replyText) {
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
									text: replyText,
									reply: {
										root: {
											uri: postUri,
											cid: postCid
										},
										parent: {
											uri: postUri,
											cid: postCid
										}
									},
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
					}
				}
			}
			else {
				console.log("Handle already reposted.");
			}
		}
		else {
			console.log("No Nano left in Giveaway.");
		}

	}
});





