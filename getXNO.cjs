const axios = require("axios");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");

// Binance API endpoint for XNO/USDT price
const BINANCE_API_URL = "https://api.binance.com/api/v3/ticker/price?symbol=XNOUSDT";

// JSON file path to store the price
const DATA_FILE = path.join(__dirname, "xno_price.json");

// Function to fetch XNO price from Binance
async function fetchAndUpdatePrice() {
  try {
    // Fetch the price from Binance API
    const response = await axios.get(BINANCE_API_URL);
    const price = parseFloat(response.data.price);

    // Log the retrieved price
    console.log(`[${new Date().toISOString()}] Fetched XNO price: $${price} USD`);

    // Write the price to the JSON file
    fs.writeFileSync(DATA_FILE, JSON.stringify({ price }), "utf-8");
    console.log("Price updated successfully.");
  } catch (error) {
    console.error("Error fetching XNO price:", error);
  }
}

// Run it immediately on startup
fetchAndUpdatePrice();