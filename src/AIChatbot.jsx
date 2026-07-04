import React, { useState } from 'react';
import { Bot, X, Send } from 'lucide-react';
import './AIChatbot.css'; // We will create this next!

function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { text: "Hi! I'm your GymXP AI coach. How can I adjust your training today?", sender: 'ai' }
  ]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input;
    
    // 1. Instantly show the user's message on the screen
    setMessages((prev) => [...prev, { text: userText, sender: 'user' }]);
    setInput('');

    try {
      // 2. Shoot the message to your FastAPI backend
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // We package the text into a JSON object matching our Python 'ChatMessage' model
        body: JSON.stringify({ message: userText }) 
      });

      const data = await response.json();

      // 3. Catch the backend's reply and print it as an AI bubble
      if (response.ok) {
        setMessages((prev) => [...prev, { text: data.reply, sender: 'ai' }]);
      } else {
        setMessages((prev) => [...prev, { text: "Hmm, my circuits are crossed. Try again.", sender: 'ai' }]);
      }
      
    } catch (error) {
      setMessages((prev) => [...prev, { text: "Cannot reach the Python server!", sender: 'ai' }]);
    }
  };

  return (
    <div className="ai-chatbot-container">
      {isOpen ? (
        <div className="ai-chat-window">
          <div className="ai-chat-header">
            <div className="ai-header-info">
              <Bot size={20} />
              <span>GymXP Coach</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="close-btn">
              <X size={20} />
            </button>
          </div>

          <div className="ai-chat-messages">
            {messages.map((msg, index) => (
              <div key={index} className={`message-bubble ${msg.sender}`}>
                {msg.text}
              </div>
            ))}
          </div>

          <form className="ai-chat-input-area" onSubmit={handleSend}>
            <input 
              type="text" 
              placeholder="Ask about your workout..." 
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button type="submit" className="send-btn">
              <Send size={18} />
            </button>
          </form>
        </div>
      ) : (
        <button className="ai-chat-toggle" onClick={() => setIsOpen(true)}>
          <Bot size={28} />
        </button>
      )}
    </div>
  );
}

export default AIChatbot;