import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pyrogram import Client
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="MorphyGram Core")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_ID = int(os.getenv("TELEGRAM_API_ID"))
API_HASH = os.getenv("TELEGRAM_API_HASH")

clients = {}

class PhoneRequest(BaseModel):
    phone: str

class CodeRequest(BaseModel):
    phone: str
    code: str
    phone_code_hash: str

class SessionRequest(BaseModel):
    session: str

@app.get("/")
def read_root():
    return {"status": "MorphyGram Backend Online"}

@app.post("/api/send-code")
async def send_code(req: PhoneRequest):
    try:
        client = Client(
            f"session_{req.phone}", 
            api_id=API_ID, api_hash=API_HASH, in_memory=True,
            device_model="iPhone 13 Pro", system_version="iOS 16.5"
        )
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
        raise HTTPException(status_code=400, detail="Сессия истекла. Запросите код заново.")
    try:
        await client.sign_in(req.phone, req.phone_code_hash, req.code)
        string_session = await client.export_session_string()
        await client.disconnect()
        del clients[req.phone]
        return {"status": "success", "session": string_session}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/get-chats")
async def get_chats(req: SessionRequest):
    try:
        client = Client(":memory:", api_id=API_ID, api_hash=API_HASH, session_string=req.session)
        await client.start()
        dialogs = []
        async for dialog in client.get_dialogs(limit=15):
            dialogs.append({"id": dialog.chat.id, "title": dialog.chat.title or dialog.chat.first_name})
        await client.stop()
        return {"status": "success", "dialogs": dialogs}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
