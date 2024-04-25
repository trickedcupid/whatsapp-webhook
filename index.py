from flask import Flask, request, jsonify
import requests
import json
import os

app = Flask(__name__)

# Configure WhatsApp API credentials
API_URL = "https://graph.facebook.com/v13.0/"
WHATSAPP_API_TOKEN = os.getenv("WHATSAPP_API_TOKEN")
PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
headers = {
    "Authorization": f"Bearer {WHATSAPP_API_TOKEN}",
    "Content-Type": "application/json",
}
whatsappAPIURL = f"{API_URL}{PHONE_NUMBER_ID}"

# To verify the callback URL from the dashboard side - Cloud API side
@app.route("/webhook", methods=["GET"])
def verify_callback():
    mode = request.args.get("hub.mode")
    challenge = request.args.get("hub.challenge")
    token = request.args.get("hub.verify_token")

    if mode and token == "12345":
        if mode == "subscribe" and token == "12345":
            return challenge, 200
        else:
            return "", 403

# Endpoint to receive messages from WhatsApp
@app.route("/webhook", methods=["POST"])
def receive_message():
    try:
        payload = request.json

        if (
            payload
            and payload.get("entry")
            and payload["entry"][0].get("changes")
            and payload["entry"][0]["changes"][0].get("value")
            and payload["entry"][0]["changes"][0]["value"].get("messages")
            and payload["entry"][0]["changes"][0]["value"]["messages"][0]
        ):
            from_number = payload["entry"][0]["changes"][0]["value"]["messages"][0]["from"]
            text_body = payload["entry"][0]["changes"][0]["value"]["messages"][0]["text"]

            chatbot_response = forward_to_chatbot(from_number, text_body)

            return "Message received and processed successfully.", 200
    except Exception as e:
        print("Error processing message:", e)
        return "Error processing message.", 500

# Endpoint to allow the chatbot to send messages via webhook gateway
@app.route("/chatbot/webhook", methods=["POST"])
def chatbot_webhook():
    try:
        data = request.json
        message = data.get("message")
        recipient_phone = data.get("recipientPhone")

        if not message or not recipient_phone:
            return (
                "Invalid request. 'message' and 'recipientPhone' are required.",
                400,
            )

        send_to_whatsapp(recipient_phone, message)
        return "Message sent to WhatsApp successfully.", 200
    except Exception as e:
        print("Error sending message to WhatsApp:", e)
        return "Error sending message to WhatsApp.", 500

# Function to forward message to the chatbot
def forward_to_chatbot(sender_phone, message):
    try:
        data = json.dumps({"message": message, "phone_number": sender_phone})

        response = requests.post(
            "http://13.245.181.43:8000/chat",
            data=data,
            headers={"Content-Type": "application/json"},
            timeout=10,
        )

        return response.json().get("response")
    except Exception as e:
        print("Error forwarding message to chatbot:", e)
        raise

# Function to send response to WhatsApp
def send_to_whatsapp(recipient_phone, message):
    try:
        payload = {
            "messaging_product": "whatsapp",
            "to": recipient_phone,
            "type": "text",
            "text": {"body": message},
        }

        requests.post(
            f"{whatsappAPIURL}/messages", json=payload, headers=headers
        )

        print(f"Message sent to {recipient_phone} on WhatsApp: {message}")
    except Exception as e:
        print("Error sending message to WhatsApp:", e)
        raise

if __name__ == "__main__":
    app.run(port=os.getenv("PORT"))
