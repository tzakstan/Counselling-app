import os
import json
from typing import Dict, Any

USERS_FILE = os.path.join(os.path.dirname(__file__), "users_db.json")

DEFAULT_USERS = {
    "counsellor": {
        "id": "usr-counsellor",
        "username": "counsellor",
        "password": "jamea@counsellor",
        "name": "Lead Counsellor",
        "role": "counsellor"
    },
    "management": {
        "id": "usr-mgmt",
        "username": "management",
        "password": "jamea@management",
        "name": "Program Management",
        "role": "management"
    }
}

def load_users() -> Dict[str, Any]:
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
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, indent=2, ensure_ascii=False)

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

