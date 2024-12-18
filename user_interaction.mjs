import * as fs from 'fs';
import nano from "./nano.mjs";
import { RichText } from "@skyware/bot";
import { checkAddress, checkAmount, checkHash, convert, Unit } from "nanocurrency";
import { isImageRequest, extractImagePrompt, handleImageGeneration } from './image_generation.mjs';
import { talkToGpt, determineTextModel } from './text_generation.mjs';
import axios from "axios";
import atprotoApi from '@atproto/api';
const { BskyAgent } = atprotoApi;

const path = './user_account.json';
const path_tx_data = './transaction_count.json';
const path_open_tips = './open_tips.json';
const xno_price_path = './xno_price.json';
const path_giveaway = './giveaway_account.json';

var nanoTip = false;

export function existsUser(username, userData) {
  // Check if the user exists in the "users" object
  if (userData.users[username]) {
    return true;
  } else {
    return false;
  }
}

export function existsOpenTips(username, openTips) {
  if (openTips.users[username]) {
    return true;
  } else {
    return false;
  }
}

export function accepted(username) {
  // Check if the user has interacted/accepted
  if (userData.users[username].accepted) {
    return true;
  } else {
    return false;
  }
}

export async function addGiveaway(username, account, tip_amount, tip_amount_converted, accessJwt, botDid) {

  // Load the JSON file content
  const rawDataGiveaway = fs.readFileSync(path_giveaway);
  const giveawayData = JSON.parse(rawDataGiveaway);

  const xnoPriceData = fs.readFileSync(xno_price_path);
  const xno_price = JSON.parse(xnoPriceData);
  const xnoPrice = xno_price.price;

  const giveawayAccount = "nano_3w1w164onyhjfurru7faoqpjssgwigcyut8z3k98megobcb4xhc88mp9e9ze";
  // const new_giveaway_account = await nano.createAccount();
  const blockhash = await nano.send(giveawayAccount, account, tip_amount_converted, nanoTip);

  //https://docs.bsky.app/docs/tutorials/creating-a-post
  //

  if (blockhash) {
    // Create direct Bluesky agent for posting
    const agent = new BskyAgent({
      service: 'https://bsky.social'
    });
    agent.session = { accessJwt };

    // Get the mention URI and CID for reply
    // const mentionUri = mention.uri;
    // const mentionCid = mention.cid;

    let tipValue = 0.05 * xnoPrice;
    tipValue = parseFloat(tipValue.toFixed(2));

    try {
      // Create the record
      const record = {
        collection: 'app.bsky.feed.post',
        repo: botDid,
        record: {
          // type: "post",
          text: "@"+username + " started a Giveaway of " + tip_amount + " Nano. Repost this post and receive 0.05 Nano (worth " + tipValue +" USD).",
          createdAt: new Date().toISOString()
        }
      };
      console.log('Sending record:', JSON.stringify(record, null, 2))

      const postResult = await agent.api.com.atproto.repo.createRecord(record);
      console.log('Post successful:', postResult);

      const uri = postResult.data.uri;
      const cid = postResult.data.cid;
      // console.log('uri: ', uri);
      // console.log('cid: ', cid);
      const possibleReposts = parseFloat(tip_amount) / 0.05;
      const currentDate = new Date();
      const formattedDate = currentDate.toISOString().split('T')[0]; // Gives "yyyy-mm-dd"

      const giveawayDataForJSON = {
        "possible_reposts": possibleReposts,
        "username": username,
        "uri": uri,
        "cid": cid,
        "reposts_count": 0,
        "reposted_by": [],
        "dateOfGiveaway": formattedDate
      };
      giveawayData.giveaways.push(giveawayDataForJSON);

      fs.writeFileSync(path_giveaway, JSON.stringify(giveawayData, null, 2));  // 'null, 2' formats the JSON with indentation

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

  return blockhash;
}

export async function addUser(username) {
  // Load the JSON file content
  const rawData = fs.readFileSync(path);
  const userData = JSON.parse(rawData);

  const rawDataOpenTips = fs.readFileSync(path_open_tips);
  const openTips = JSON.parse(rawDataOpenTips);
  // Check if the user exists because there was a tip already move from openTips to userData
  if (existsOpenTips(username, openTips) && !existsUser(username, userData)) {
    const tippedUserAccountOpen = openTips.users[username].account;
    //account = nano.createAccount;
    userData.users[username] = {
      "account": tippedUserAccountOpen
    };
    console.log(`User '${username}' accepted the tip.`);

    //remove from openTips
    if (openTips.users[username]) {
      delete openTips.users[username];
    } else {
      console.log("User does not exist.");
    }
    fs.writeFileSync(path, JSON.stringify(userData, null, 2));  // 'null, 2' formats the JSON with indentation
    fs.writeFileSync(path_open_tips, JSON.stringify(openTips, null, 2));  // 'null, 2' formats the JSON with indentation

    return true;

    //or else, check if the user is not existing, then create a new user
  } else if (!existsUser(username, userData)) {
    const new_user_account = await nano.createAccount();
    userData.users[username] = {
      "account": new_user_account
    };
    console.log(`User '${username}' created.`);
    // Save the updated data back to the JSON file
    fs.writeFileSync(path, JSON.stringify(userData, null, 2));  // 'null, 2' formats the JSON with indentation
    return true;
  } else {
    console.log(`User '${username}' already exists.`);
    return true;
  }
}

export function validateTipText(text) {

  const targetPhrase = '@tipnano.bsky.social';
  let tip_amount = null;
  let tipped_user = null;

  // Check if the text contains the phrase
  if (text.includes(targetPhrase)) {

    // Normalize line breaks to spaces
    const normalizedText = text.replace(/\s+/g, ' '); // Replaces multiple spaces or \n with a single space

    // Extract the index of the target phrase
    const phraseIndex = normalizedText.indexOf(targetPhrase);

    // Split the text starting from where the target phrase ends
    const parts = normalizedText.slice(phraseIndex + targetPhrase.length).trim().split(' ');

    // Check if the first part (after target phrase) is a number
    const numberPart = parseFloat(parts[0]);
    console.log("numberPart: ", numberPart);
    if (!isNaN(numberPart) && numberPart >= 0.01) {
      tip_amount = parts[0];
      console.log("tip_amount: ", tip_amount);

      const nextPart = parts[1]; // The word/part after the number

      // Check conditions for the next part
      if (nextPart.startsWith('@')) {
        tipped_user = nextPart.substring(1);
        return { tipAmount: tip_amount, tippedUser: tipped_user, tipping: true };
      } else if (nextPart.toLowerCase() === 'giveaway') {
        return { tipAmount: tip_amount, giveaway: true };
      } else {
        return { targetNotFound: true };
      }
    } else {
      return { tipToSmall: true };
    }
  } else {
    return { targetNotFound: true };
  }
}


export async function handleMessage(text, username, accessJwt, botDid) {
  // Convert message to lowercase to make the comparison case-insensitive
  let lowerCaseText = text.toLowerCase();
  // Normalize line breaks to spaces
  const normalizedText = lowerCaseText.replace(/\s+/g, ' ');
  // Extract the first word
  const firstWord = normalizedText.split(' ')[0] || ""; // Handles empty strings
  let restOfText;
  let answerText = "Error";
  let additionalAnswerText = "Error";
  let account;
  let account_balance;
  let result_account_balance;
  let tip_amount;
  let tip_amount_converted;
  // Load the JSON file content
  const rawData = fs.readFileSync(path);
  const userData = JSON.parse(rawData);

  if (!existsUser(username, userData)) {
    if (addUser(username)) {
      answerText = "Thanks for reaching out - your account was created. \n\n Send \"help\" for more information about a specific command.";
      //return answerText;
      return [answerText, additionalAnswerText];
    }

  } else {

    switch (firstWord) {
      case "balance":

        account = userData.users[username].account;
        //await nano.receive_all(account);
        await nano.receive_all(account);
        result_account_balance = await nano.balance(account);
        account_balance = result_account_balance.balance;

        answerText = "Account Balance: " + account_balance + " Nano";
        console.log(answerText);
        console.log(account_balance);
        break;

      case "deposit":

        account = userData.users[username].account;

        answerText = "You can deposit Nano to the following account:";// + account;
        additionalAnswerText = account;//.toString();

        break;

      case "help":

        answerText = "Command overview \n\nUse \"help\" for more information about a specific command. \n\n\"Balance\" \nShows your account balance \n\n\"Deposit\" \n Shows your account address. \n\n\"Withdraw\" \nWithdraw to an external Nano address. \nExample withdrawing 10 Nano: \nWithdraw 10 nano_1kxw17qafsgjrs7d8xa6powp3umxrk9yik7wtqyojq7xm7n8t6pgq4fbw41c \n\n\"Donate\" \nDonate to the Nano TipBot. \nExample donating 10 Nano: Donate 10 \n\n\"Giveaway\" \nStarts a giveaway. \nExample giving away 10 Nano, 0.05 Nano for everyone reposting the post until the specified amount is empty: \nGiveaway 10";
        break;

      case "withdraw":

        account = userData.users[username].account;
        await nano.receive_all(account);
        result_account_balance = await nano.balance(account)
        account_balance = result_account_balance.balance;

        restOfText = normalizedText.slice(firstWord.length).trim();
        // check if there is more text
        if (restOfText.length > 0) {
          const parts = restOfText.split(' ');
          if (parts.length >= 2) {
            const withdraw_account = parts[1];
            tip_amount = parts[0];
            console.log("tip_amount:" + tip_amount + "test");
            if (checkAddress(withdraw_account)) {
              console.log("address_valid:" + withdraw_account);
              if (parseFloat(tip_amount) <= parseFloat(account_balance)) {
                try {
                  console.log("number:" + tip_amount);
                  tip_amount_converted = convert(tip_amount, { from: Unit.Nano, to: Unit.raw, });
                  await nano.send(withdraw_account, account, tip_amount_converted, nanoTip)
                  answerText = tip_amount + " Nano sent to " + withdraw_account;
                } catch (error) {
                  // Handle any errors that occur
                  console.error("An error occurred:", error.message);
                  answerText = "Invalid amount";
                }
              } else {
                answerText = "Not enough Nano in your account";
              }
            } else {
              answerText = "Invalid Nano address";
            }
          } else {
            answerText = "Invalid Nano address";
          }
        } else {
          answerText = "Invalid Nano address";
        }
        break;


      case "giveaway":

        account = userData.users[username].account;
        await nano.receive_all(account);
        result_account_balance = await nano.balance(account)
        account_balance = result_account_balance.balance;

        restOfText = normalizedText.slice(firstWord.length).trim();
        // check if there is more text
        if (restOfText.length > 0) {
          const parts = restOfText.split(' ');
          if (parts.length >= 1) {
            tip_amount = parts[0];
            console.log("giveaway amount:" + tip_amount);

            if (parseFloat(tip_amount) <= parseFloat(account_balance)) {
              try {
                tip_amount_converted = convert(tip_amount, { from: Unit.Nano, to: Unit.raw, });
                const blockhash = await addGiveaway(username, account, tip_amount, tip_amount_converted, accessJwt, botDid);
                console.log("blockhash: ", blockhash);
                answerText = "You started a giveaway of " + tip_amount + " Nano. \n\nThe giveaway will be published within a few seconds.";
              } catch (error) {
                // Handle any errors that occur
                console.error("An error occurred:", error.message);
                answerText = "An error occurred:", error.message;
              }
            } else {
              answerText = "Not enough Nano in your account";
            }
          } else {
            answerText = "Invalid text";
          }
        } else {
          answerText = "Invalid text";
        }

        break;

      case "donate":

        account = userData.users[username].account;
        await nano.receive_all(account);
        result_account_balance = await nano.balance(account)
        account_balance = result_account_balance.balance;

        restOfText = normalizedText.slice(firstWord.length).trim();
        // check if there is more text
        if (restOfText.length > 0) {
          const parts = restOfText.split(' ');
          if (parts.length >= 1) {
            tip_amount = parts[0];
            console.log("tip_amount:" + tip_amount + "test");
            // Donation address
            const donation_address = "nano_1kxw17qafsgjrs7d8xa6powp3umxrk9yik7wtqyojq7xm7n8t6pgq4fbw41c";

            if (parseFloat(tip_amount) <= parseFloat(account_balance)) {
              try {
                tip_amount_converted = convert(tip_amount, { from: Unit.Nano, to: Unit.raw, });
                console.log("tip_amount_converted: ", tip_amount_converted);
                nano.send(donation_address, account, tip_amount_converted, nanoTip)
                answerText = tip_amount + " Nano donated. \n\nThank you :)";
              } catch (error) {
                // Handle any errors that occur
                console.error("An error occurred:", error.message);
                answerText = "Invalid amount";
              }
            } else {
              answerText = "Not enough Nano in your account";
            }
          } else {
            answerText = "Invalid text";
          }
        } else {
          answerText = "Invalid text";
        }
        break;

      default:
        answerText = "Command overview \n\nUse \"help\" for more information about a specific command. \n\n\"Balance\" \nShows your account balance \n\n\"Deposit\" \n Shows your account address. \n\n\"Withdraw\" \nWithdraw to an external Nano address. \nExample withdrawing 10 Nano: \nWithdraw 10 nano_1kxw17qafsgjrs7d8xa6powp3umxrk9yik7wtqyojq7xm7n8t6pgq4fbw41c \n\n\"Donate\" \nDonate to the Nano TipBot. \nExample donating 10 Nano: Donate 10 \n\n\"Giveaway\" \nStarts a giveaway. \nExample giving away 10 Nano, 0.05 Nano for everyone reposting the post until the specified amount is empty: \nGiveaway 10";
        break;
    }
    //return answerText;
    //console.log("Returning an array:", [answerText, additionalAnswerText]);
    return [answerText, additionalAnswerText];
  }
}


export async function handleMessageNanoGPT(text, handle, accountaddress) {
  try {
    console.log('\n=== Starting Message Handler ===');
    console.log('Received text:', text);

    //const targetPhrase = '@nanogptbot.bsky.social';
    // // Check if the text contains the phrase
    // if (fullText.includes(targetPhrase)) {

    //   // Normalize line breaks to spaces
    //   const normalizedText = fullText.replace(/\s+/g, ' ').toLowerCase(); // Replaces multiple spaces or \n with a single space
    //   // Extract the index of the target phrase
    //   const text = await normalizedText.indexOf(targetPhrase).toString();
    //   console.log('text: ', text);
    //   // Split the text starting from where the target phrase ends
    //   //const parts = normalizedText.slice(phraseIndex + targetPhrase.length).trim().split(' ');

    if (isImageRequest(text)) {
      console.log('Handling as image request');
      const prompt = extractImagePrompt(text);
      if (!prompt) {
        return {
          success: false,
          error: "Please provide a description of the image you want to generate."
        };
      }

      const result = await handleImageGeneration(prompt, handle, accountaddress);
      console.log('Image generation result:', result);
      if (result && result.success) {
        return {
          success: true,
          response: "Here's your generated image!",
          imageData: result.imageData,
          type: 'image'
        };
      } else {
        return {
          success: false,
          error: result.error || "Sorry, I couldn't generate the image. Please try again later.",
          type: 'image'
        };
      }
    } else if (text.toLowerCase().includes("help")) {
      console.log('Handling help request');
      return {
        success: true,
        response: "I can help you with:\n" +
          "1. Chatting - Just tag me and I'll respond!\n" +
          "2. Image Generation - Start your message with 'image' or 'generate image'\n" +
          "3. Tips - Use: @tipnano.bsky.social [amount] @username.bsky.social",
        type: 'text'
      };
    } else {
      console.log('Handling as text request');
      const model = determineTextModel(text);
      console.log('Using model:', model);

      const result = await talkToGpt(text, [], model, accountaddress);
      console.log('Text generation result:', result);

      if (!result || !result.response) {
        console.error('Invalid text generation result:', result);
        throw new Error('Failed to generate text response');
      }

      return {
        success: true,
        response: result.response,
        type: 'text'
      };
    }
    //}


  } catch (error) {
    console.error('Error in handleMessage:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    });
    return {
      success: false,
      error: error.message || "An error occurred while processing your message",
      type: isImageRequest(text) ? 'image' : 'text'
    };
  }
}


export async function getLatestRepost(userHandleOrDid, authToken){
  
  const BASE_URL = "https://bsky.social/xrpc"; // The Bluesky AT Protocol endpoint

  try {
      // Fetch the user’s timeline/posts
      const response = await axios.get(`${BASE_URL}/app.bsky.feed.getAuthorFeed`, {
          params: { actor: userHandleOrDid },
          headers: {
              Authorization: `Bearer ${authToken}`,
          },
      });

      const feed = response.data.feed;

      // Find the first repost in the timeline
      const latestRepost = feed[0];
      // const latestRepost = feed.find((post) => post.reason === "repost");

      console.log("feed: ", feed[0]);

      if (latestRepost) {
          const repostCid = latestRepost.post.cid;
          console.log(`Latest repost CID: ${repostCid}`);
          return repostCid;
      } else {
          console.log("No reposts found in the user's feed.");
          return null;
      }
  } catch (error) {
      console.error("Error fetching the latest repost:", error.response?.data || error.message);
      throw error;
  }
}

