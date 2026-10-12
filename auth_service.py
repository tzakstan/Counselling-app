import os
import json
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL")
USERS_FILE = os.path.join(os.path.dirname(__file__), "users_db.json")

DEFAULT_USERS = {
    "counsellor": {
        "id": "usr-counsellor",
        "username": "counsellor",
        "password": "counsel@2026",
        "name": "Lead Counsellor",
        "role": "counsellor"
    },
    "management": {
        "id": "usr-mgmt",
        "username": "management",
        "password": "mgmt@2026",
        "name": "Program Management",
        "role": "management"
    }
}

from data_store import _get_pg_conn

def load_users() -> Dict[str, Any]:
    conn = _get_pg_conn()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT content FROM app_storage WHERE key = 'users';")
                row = cur.fetchone()
                if row:
                    return json.loads(row[0])
                else:
                    save_users(DEFAULT_USERS)
                    return DEFAULT_USERS
        except Exception as e:
            logger.error(f"Error reading users from PostgreSQL: {e}")
        finally:
            conn.close()

    if not os.path.exists(USERS_FILE):
        save_users(DEFAULT_USERS)
        return DEFAULT_USERS
    try:
        with open(USERS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        save_users(DEFAULT_USERS)
        return DEFAULT_USERS

def save_users(users: Dict[str, Any]):
    data_json = json.dumps(users, indent=2, ensure_ascii=False)
    conn = _get_pg_conn()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO app_storage (key, content)
                    VALUES ('users', %s)
                    ON CONFLICT (key) DO UPDATE SET content = EXCLUDED.content;
                """, (data_json,))
            conn.commit()
        except Exception as e:
            logger.error(f"Error saving users to PostgreSQL: {e}")
        finally:
            conn.close()

    with open(USERS_FILE, "w", encoding="utf-8") as f:
        f.write(data_json)

def update_user_profile(user_id: str, new_name: str, new_username: str, new_password: str = None) -> Dict[str, Any]:
    users = load_users()
    target_key = None
    for k, u in users.items():
        if u.get("id") == user_id:
            target_key = k
            break
            
    if not target_key:
        raise ValueError("User not found")
        
    user = users[target_key]
    user["name"] = new_name.strip()
    new_username_clean = new_username.strip().lower()
    user["username"] = new_username_clean
    
    if new_password and new_password.strip():
        user["password"] = new_password.strip()

    # Re-index if username changed
    if target_key != new_username_clean:
        del users[target_key]
        users[new_username_clean] = user
    else:
        users[target_key] = user

    save_users(users)
    return user
