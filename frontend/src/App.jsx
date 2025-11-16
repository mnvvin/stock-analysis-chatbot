import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Send, TrendingUp, Cpu } from 'lucide-react';

// --- Utility Function to render basic Markdown for professional output ---
const renderMarkdown = (text) => {
  if (!text) return null;

  // Simple renderer: bold, italics, and newlines
  let content = text
    .split('\n')
    .map((line, i) => {
      // Bold **text**
      line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Italics *text*
      line = line.replace(/\*(.*?)\*/g, '<em>$1</em>');
      // Unordered lists (simple dashes)
      if (line.trim().startsWith('- ')) {
        return <li key={i} className="ml-4 list-disc">{line.substring(2)}</li>;
      }
      return <p key={i} className="mb-1" dangerouslySetInnerHTML={{ __html: line }} />;
    });

  // Wrap list items if present
  if (content.some(el => el.type === 'li')) {
    let listStarted = false;
    const finalContent = [];
    content.forEach(el => {
      if (el.type === 'li') {
        if (!listStarted) {
          finalContent.push(<ul key={`ul-start-${el.key}`} className="list-inside text-sm mt-1">{el}</ul>);
          listStarted = true;
        } else {
          finalContent[finalContent.length - 1].props.children.push(el);
        }
      } else {
        listStarted = false;
        finalContent.push(el);
      }
    });
    return finalContent;
  }
  
  return content;
};

// Main App Component (Presentation Layer)
const App = () => {
  const [messages, setMessages] = useState([
    { 
      sender: 'bot', 
      // --- UPDATED WELCOME MESSAGE AND NAME ---
      text: "Hello! I am **Stock Analyzer**, your dedicated financial analysis chatbot. Ask me for a market analysis on a stock like **AAPL** or **GOOG**.",
      is_analysis: true
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatWindowRef = useRef(null);

  // FastAPI backend runs on port 8000
  const BACKEND_URL = 'http://127.0.0.1:8000/chat';

  // Auto-scroll to the bottom when messages update
  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userQuery = input.trim();
    
    // 1. Display user message
    const userMessage = { sender: 'user', text: userQuery, is_analysis: false };
    setMessages((prev) => [...prev, userMessage]);
    
    setInput('');
    setIsLoading(true);

    try {
      // 2. Call the FastAPI backend
      const response = await axios.post(BACKEND_URL, { user_query: userQuery });
      
      const botResponse = { 
        sender: 'bot', 
        text: response.data.response_text || "The analysis returned an empty result.", 
        ticker: response.data.ticker,
        is_analysis: response.data.is_analysis 
      };

      // 3. Display bot response
      setMessages((prev) => [...prev, botResponse]);
      
    } catch (error) {
      console.error("API Error:", error);
      let errorMessage = "Connection failed. Please ensure the FastAPI backend is running on http://127.0.0.1:8000 and your API key is correct.";
      
      if (error.response && error.response.status === 422) {
        errorMessage = "Invalid request format. The server rejected the query.";
      }

      const errorMsg = { sender: 'bot', text: `**Error:** ${errorMessage}`, is_analysis: true };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Tailwind-like classes for a modern, dark theme UI
  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100 p-4 sm:p-6 font-sans">
      
      {/* Header */}
      <header className="flex items-center justify-center p-4 bg-gray-800 rounded-xl shadow-lg mb-4">
        <TrendingUp className="w-8 h-8 text-green-400 mr-3" />
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Stock Analysis Chatbot {/* <-- Title updated here */}
        </h1>
      </header>

      {/* Chat Window */}
      <div 
        ref={chatWindowRef} 
        className="flex-grow overflow-y-auto space-y-4 p-4 bg-gray-800 rounded-xl shadow-inner mb-4 custom-scrollbar"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }} // Hide scrollbar
      >
        {messages.map((msg, index) => (
          <div 
            key={index} 
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-xs sm:max-w-md p-3 rounded-xl shadow-md transition-all duration-300 ${
                msg.sender === 'user' 
                  ? 'bg-blue-600 text-white rounded-br-none' 
                  : 'bg-gray-700 text-gray-100 rounded-tl-none border-t border-l border-gray-600'
              }`}
            >
              <div className="flex items-center mb-1">
                {msg.sender === 'bot' && <Cpu className="w-4 h-4 mr-2 text-green-400 flex-shrink-0" />}
                <strong className="text-xs font-semibold uppercase opacity-70">
                  {msg.sender === 'user' ? 'You' : 'Stock Analyzer'} {/* <-- Bot name updated here */}
                </strong>
                {msg.ticker && msg.sender === 'bot' && (
                  <span className={`ml-2 px-2 py-0.5 text-xs font-bold rounded-full ${msg.ticker === 'AAPL' ? 'bg-yellow-500 text-gray-900' : 'bg-green-500 text-gray-900'}`}>
                    {msg.ticker}
                  </span>
                )}
              </div>
              <div className="text-sm leading-relaxed whitespace-pre-wrap">
                {renderMarkdown(msg.text)}
              </div>
            </div>
          </div>
        ))}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-xs sm:max-w-md p-3 bg-gray-700 text-gray-100 rounded-xl rounded-tl-none">
              <div className="flex items-center text-sm">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-400 mr-2"></div>
                Analyzing data...
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="flex p-3 bg-gray-800 rounded-xl shadow-2xl">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={isLoading ? "Analysis in progress..." : "Type your query (e.g., 'What is the price of AAPL?')..."}
          className="flex-grow p-3 mr-3 rounded-lg bg-gray-700 text-black border border-gray-600 focus:outline-none focus:border-green-400 transition-colors placeholder-gray-400"
          disabled={isLoading}
        />
        <button 
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
          className={`p-3 rounded-lg flex items-center justify-center transition-all duration-200 ${
            isLoading || !input.trim() 
              ? 'bg-gray-600 cursor-not-allowed text-gray-400' 
              : 'bg-green-500 hover:bg-green-600 text-white shadow-md'
          }`}
        >
          <Send className="w-5 h-5" />
        </button>
      </div>

      {/* Custom Scrollbar Style (CSS for the Chat Window) */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default App;