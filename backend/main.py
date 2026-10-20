import os
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pyrogram import Client
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="MorphyGram Web API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # В продакшене замени на URL твоего фронтенда
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_ID = int(os.getenv("TELEGRAM_API_ID"))
API_HASH = os.getenv("TELEGRAM_API_HASH")
ADMIN_KEY = os.getenv("ADMIN_SECRET_KEY")

clients = {}

class PhoneRequest(BaseModel):
    phone: str

class CodeRequest(BaseModel):
    phone: str
    code: str
    phone_code_hash: str
    admin_key: str = None

class CommandRequest(BaseModel):
    session: str
    command: str
    target: str = None

@app.get("/")
def read_root():
    return {"status": "online", "app": "MorphyGram Web Backend"}

@app.post("/api/send-code")
async def send_code(req: PhoneRequest):
    try:
        client = Client(f"session_{req.phone}", api_id=API_ID, api_hash=API_HASH, in_memory=True)
        await client.connect()
        sent_code = await client.send_code(req.phone)
        clients[req.phone] = client
        return {"status": "success", "phone_code_hash": sent_code.phone_code_hash}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/login")
async def login(req: CodeRequest):
    client = clients.get(req.phone)
    if not client:
        raise HTTPException(status_code=400, detail="Сессия не найдена. Запросите код заново.")
    try:
        await client.sign_in(req.phone, req.phone_code_hash, req.code)
        string_session = await client.export_session_string()
        await client.disconnect()
        del clients[req.phone]
        
        is_admin = False
        if req.admin_key and req.admin_key == ADMIN_KEY:
            is_admin = True
            
        return {"status": "success", "session": string_session, "is_admin": is_admin}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/command")
async def execute_command(req: CommandRequest):
    try:
        # Подключаемся через строку сессии
        client = Client(":memory:", api_id=API_ID, api_hash=API_HASH, session_string=req.session)
        await client.start()
        
        cmd = req.command.lower()
        
        if cmd == ".mute" and req.target:
            # Логика мута: например, отключение уведомлений (архивация диалога)
            await client.archive_chats(chat_id=req.target)
            result = f"Пользователь {req.target} успешно замучен (архивирован)."
        elif cmd == ".unmute" and req.target:
            await client.unarchive_chats(chat_id=req.target)
            result = f"Пользователь {req.target} размучен (разархивирован)."
        else:
            result = "Неизвестная команда. Доступны: .mute, .unmute"
            
        await client.stop()
        return {"status": "success", "result": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
