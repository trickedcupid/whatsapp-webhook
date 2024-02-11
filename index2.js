const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser')

require('dotenv').config()

const app = express();
const PORT = process.env.PORT;

// To parse JSON bodies
app.use(bodyParser.json())

// Configure WhatsApp API credentials
const API_URL = "https://graph.facebook.com/v13.0/";
const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const headers = {
    "Authorization": `Bearer ${WHATSAPP_API_TOKEN}`,
    "Content-Type": "application/json"
};
const whatsappAPIURL = `${API_URL}${PHONE_NUMBER_ID}`;


//To verify the callback url from dashboard side - Cloud API side
app.get("/webhook", (req,res) => {
    let mode = req.query["hub.mode"];
    let challenge = req.query["hub.challenge"];
    let token = req.query["hub.verify_token"];


    if(mode && token==="12345") {

        if (mode==="subscribe" && token==='12345'){
            res.status(200).send(challenge);
        }else{
            res.status(403);
        }
    }
});

// Endpoint to receive messages from WhatsApp
app.post('/webhook', async (req, res) => {
    try {
        
        const payload = req.body;

        // Check if payload is defined and has the expected structure
        if (payload && payload.entry && payload.entry[0] && payload.entry[0].changes &&
            payload.entry[0].changes[0] && payload.entry[0].changes[0].value &&
            payload.entry[0].changes[0].value.messages && payload.entry[0].changes[0].value.messages[0]) {
            
        // Extract relevant information from the payload
        const { from, text } = payload.entry[0].changes[0].value.messages[0];
        console.log(JSON.stringify(text.body))
            
        // //Send Echo to whatsapp
        // await sendToWhatsApp(from, text.body);
            
        // Forward the message to the chatbot
        const chatbotResponse = await forwardToChatbot(from, text.body);
            
        // Send the chatbot response back to WhatsApp
        await sendToWhatsApp(from, chatbotResponse);
            
        return res.status(200).send("Message received and processed successfully.");
    } catch (error) {
        console.error("Error processing message:", error);
        res.status(500).send("Error processing message.");
    }
});

// Endpoint to allow the chatbot to send messages via webhook gateway
app.post('/chatbot/webhook', async (req, res) => {
    try {
        const { message, recipientPhone } = req.body;

        // Check if required fields are present in the request body
        if (!message || !recipientPhone) {
            return res.status(400).send("Invalid request. 'message' and 'recipientPhone' are required.");
        }

        // Send the message to WhatsApp
        await sendToWhatsApp(recipientPhone, message);
        res.status(200).send("Message sent to WhatsApp successfully.");
        
    } catch (error) {
        console.error("Error sending message to WhatsApp:", error);
        res.status(500).send("Error sending message to WhatsApp.");
    }
});

// Function to forward message to the chatbot
async function forwardToChatbot(senderPhone, message) {
    try {
        let data = JSON.stringify({
            "message": message,
            "phone_number": senderPhone
        });

        console.log(message)
        console.log(senderPhone)
        console.log(data)

        const response = await axios.post('http://13.245.181.43:8000/chat', data, {
            headers: { 
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        console.log(JSON.stringify(response.data));
        return response.data.response;
        
    } catch (error) {
         if (error.response) {
            console.error("Error forwarding message to chatbot:", error.response.data);
        } else if (error.request) {
            console.error("No response received from chatbot server.");
        } else {
            console.error("Error with request:", error.message);
        }
        throw new Error("Error forwarding message to chatbot.");
    }
}
// Function to send response to WhatsApp
async function sendToWhatsApp(recipientPhone, message) {
    try {
        const payload = {
            "messaging_product": "whatsapp",
            "to": recipientPhone,
            "type": "text",
            "text": {
                "body": `${message}`
            }
        };
        // const response = await axios.post(`${whatsappAPIURL}/messages`, payload, { headers });
        await axios.post(`${whatsappAPIURL}/messages`, payload, { headers });
        console.log(`Message sent to ${recipientPhone} on WhatsApp: ${message}`);
        // return response.data;
    } catch (error) {
        throw new Error("Error sending message to WhatsApp.");
    }
}

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
