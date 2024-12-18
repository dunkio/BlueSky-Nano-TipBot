# BlueSky-Nano-TipBot
BlueSky: Nano-TipBot and NanoGPT-Bot

You need to create an ".env-File" and set the respective parameters.

Most relevant files for the Nano-TipBot: bsky_bot.mjs and user_interaction.mjs

ToDo:
- Update the actual session and retrieve a new accessToken (needs to be done every 15 minutes, for now I am just restarting the script, but that will run into problems if there are more users)
- On Repost reply under the repost and not under own post (CID and URI of the repost is needed, I was not able to retrieve the CID)
- Enable quoting for Giveaways

