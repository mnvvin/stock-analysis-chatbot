import re
import json
import requests
from typing import Optional, Dict
from pydantic import BaseModel
from abc import ABC, abstractmethod

# --- 1. DOMAIN LAYER (Core Business Logic) ---

class StockData(BaseModel):
    """Value Object representing the factual stock data."""
    ticker: str
    price: float
    change_percent: float
    volume: int

class ChatQuery(BaseModel):
    """Data Transfer Object (DTO) for incoming user request."""
    user_query: str

class ChatResponse(BaseModel):
    """Data Transfer Object (DTO) for outgoing response."""
    response_text: str
    ticker: Optional[str] = None
    is_analysis: bool = True

class IStockDataRepository(ABC):
    """Domain Interface: Defines the contract for fetching real-time data."""
    @abstractmethod
    def get_latest_data(self, ticker: str) -> Optional[StockData]:
        pass

# --- 2. INFRASTRUCTURE LAYER (External Dependencies) ---

class MockStockRepository(IStockDataRepository):
    """Infrastructure Implementation: Fetches (Mocks) stock data."""
    def get_latest_data(self, ticker: str) -> Optional[StockData]:
        if ticker.upper() == "AAPL":
            return StockData(
                ticker="AAPL",
                price=178.12,  # Slight change in mock data for realism
                change_percent=1.15,
                volume=135000000
            )
        elif ticker.upper() == "GOOG":
            return StockData(
                ticker="GOOG",
                price=1465.90, # Slight change in mock data
                change_percent=-0.33,
                volume=32000000
            )
        else:
            return None

class GeminiAnalyzer:
    """Infrastructure Tool: Communicates with the Gemini API for analysis."""
    
    APP_ID = "" 

    def __init__(self):
        self.APP_ID = globals().get('__app_id', 'default-app-id')
        # NOTE: Make sure to replace "YOUR_PASTED_API_KEY_HERE" with your actual key
        self.API_KEY = "AIzaSyCyV2BwPOUh0bKuAYjlaHYCq3y551ACO5I"
        self.API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key={self.API_KEY}"

    def get_analysis(self, user_query: str, stock_data: Optional[StockData]) -> str:
        """Generates a professional analysis using the provided stock data as context."""
        
        # --- UPDATED SYSTEM PROMPT ---
        system_prompt = (
            "You are 'Stock Analyzer', a sophisticated and professional financial chatbot for a platform called 'Stock Analysis Chatbot'. "
            "Your task is to analyze the user's query and the provided factual stock data. "
            "Provide a concise, highly readable, and professional response. "
            "Use markdown formatting (like **bold**) to highlight key numbers (price, change, volume). "
            "If data is provided, use it for your analysis. If no data is provided, state clearly what you can and cannot do."
        )
        # --- END UPDATED SYSTEM PROMPT ---

        if stock_data:
            # Prepare contextual data for the LLM
            context_data = stock_data.model_dump_json(indent=2)
            user_prompt = (
                f"Analyze the user's request: '{user_query}'. "
                f"Use ONLY the following current stock data for your response:\n\n{context_data}\n\n"
                "Please provide a full, conversational analysis based on this context."
            )
        else:
            user_prompt = (
                f"Analyze the user's request: '{user_query}'. "
                "Since no stock data was provided, explain that the ticker could not be found or that you need a specific ticker (like 'AAPL' or 'GOOG') to proceed."
            )

        payload = {
            "contents": [{"parts": [{"text": user_prompt}]}],
            "systemInstruction": {"parts": [{"text": system_prompt}]}
        }

        # Simple retry mechanism (exponential backoff not fully implemented for brevity)
        for _ in range(3):
            try:
                # Check for API Key presence before making the request
                if not self.API_KEY or self.API_KEY == "YOUR_PASTED_API_KEY_HERE":
                    return "I apologize, the AI analysis engine is currently unavailable. Please check your API key."

                response = requests.post(self.API_URL, json=payload, timeout=20)
                response.raise_for_status()
                
                result = response.json()
                text = result['candidates'][0]['content']['parts'][0]['text']
                return text
            except Exception as e:
                print(f"Gemini API call failed: {e}. Retrying...")
                import time
                time.sleep(2)
        
        return "I apologize, the AI analysis engine is currently unavailable. Please try again later."

# --- 3. APPLICATION LAYER (Use Case / Orchestrator) ---

class ChatService:
    """Application Service: Handles the 'Process Chat Query' use case."""
    
    def __init__(self, stock_repo: IStockDataRepository, analyzer: GeminiAnalyzer):
        self.stock_repo = stock_repo
        self.analyzer = analyzer

    def process_query(self, query: ChatQuery) -> ChatResponse:
        ticker = self._extract_ticker(query.user_query)
        
        stock_data = None
        if ticker:
            # 1. Fetch raw data using Repository (Infrastructure)
            stock_data = self.stock_repo.get_latest_data(ticker)
        
        # 2. Generate analysis using the Gemini Analyzer (Infrastructure)
        analysis_text = self.analyzer.get_analysis(query.user_query, stock_data)
        
        # 3. Return a clean Application Response DTO
        return ChatResponse(
            response_text=analysis_text,
            ticker=ticker,
            is_analysis=True
        )

    def _extract_ticker(self, query: str) -> Optional[str]:
        """Simple helper to extract a potential stock ticker using keywords."""
        query = query.upper()
        
        # Check for common tickers and names
        if "AAPL" in query or "APPLE" in query:
            return "AAPL"
        elif "GOOG" in query or "GOOGLE" in query:
            return "GOOG"
        
        # Simple regex for 1-4 letter strings
        match = re.search(r'\b[A-Z]{1,4}\b', query)
        if match:
            return match.group(0)
            
        return None

# --- 4. INTERFACE/INFRASTRUCTURE LAYER (FastAPI Wiring) ---

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

# Dependency Injection setup
def get_chat_service() -> ChatService:
    """Dependency injector that wires the Application Service with its Infrastructure dependencies."""
    stock_repo = MockStockRepository() 
    analyzer = GeminiAnalyzer() 
    return ChatService(stock_repo=stock_repo, analyzer=analyzer)

# Main Application Instance
app = FastAPI(
    title="Stock Analysis Chatbot Backend", # <-- Title updated here
    description="Stock Chatbot API built with Clean Architecture.",
    version="1.0.0"
)

# CORS Middleware setup (Crucial for React connection)
origins = ["http://localhost:5173", "http://localhost:3000"] # Match your React port
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Endpoint
@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(
    query: ChatQuery,
    chat_service: ChatService = Depends(get_chat_service)
):
    """Handles chat messages, orchestrates analysis, and returns a response."""
    return chat_service.process_query(query)