import os
import uuid
from datetime import datetime
from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional

from models import Student, GeneratedReport, Comment, CumulativeReport, LoginRequest, UserProfile, UpdateUserRequest
from data_store import (
    load_students,
    get_student_by_id,
    save_or_update_student,
    delete_student,
    get_or_create_cumulative_report,
    check_db_health,
    set_runtime_database_url,
    get_sample_student
)
from gemini_service import (
    generate_individual_report,
    set_api_key,
    get_api_key
)
from docx_generator import generate_student_docx, generate_cumulative_docx
from auth_service import load_users, update_user_profile

app = FastAPI(title="Saire Ilmi Counselling & Evaluation System")

@app.post("/api/auth/login", response_model=UserProfile)
def login(creds: LoginRequest):
    users = load_users()
    u = users.get(creds.username.strip().lower())
    if not u or u["password"] != creds.password.strip():
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return UserProfile(
        id=u["id"],
        username=u["username"],
        name=u["name"],
        role=u["role"]
    )

@app.put("/api/auth/profile", response_model=UserProfile)
def update_profile(req: UpdateUserRequest):
    try:
        updated = update_user_profile(
            user_id=req.user_id,
            new_name=req.name,
            new_username=req.username,
            new_password=req.password
        )
        return UserProfile(
            id=updated["id"],
            username=updated["username"],
            name=updated["name"],
            role=updated["role"]
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.delete("/api/students/{student_id}")
def delete_student_endpoint(student_id: str):
    success = delete_student(student_id)
    if not success:
        raise HTTPException(status_code=404, detail="Student not found")
    return {"status": "success", "deleted_id": student_id}



STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(STATIC_DIR, exist_ok=True)

# Mount static files
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
def read_root():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))

@app.get("/api/students", response_model=List[Student])
def get_all_students():
    return load_students()

@app.get("/api/students/sample-data", response_model=Student)
def get_sample_student_data():
    return get_sample_student()

@app.post("/api/students/load-sample", response_model=Student)
def load_sample_student():
    sample = get_sample_student()
    sample.updated_at = datetime.now().isoformat()
    return save_or_update_student(sample)

@app.get("/api/students/{student_id}", response_model=Student)
def get_student(student_id: str):
    s = get_student_by_id(student_id)
    if not s:
        raise HTTPException(status_code=404, detail="Student not found")
    return s

@app.post("/api/students", response_model=Student)
def create_student(student: Student):
    if not student.id:
        student.id = f"SI-2026-{uuid.uuid4().hex[:4].upper()}"
    student.created_at = datetime.now().isoformat()
    student.updated_at = datetime.now().isoformat()
    return save_or_update_student(student)

@app.put("/api/students/{student_id}", response_model=Student)
def update_student(student_id: str, student: Student):
    existing = get_student_by_id(student_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Student not found")
    student.id = student_id
    student.updated_at = datetime.now().isoformat()
    return save_or_update_student(student)

@app.post("/api/students/{student_id}/generate-report", response_model=Student)
def generate_report_for_student(student_id: str):
    student = get_student_by_id(student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    report = generate_individual_report(student)
    student.report = report
    student.status = "Evaluated" if not report.follow_up_recommended else "Follow-up Scheduled"
    student.updated_at = datetime.now().isoformat()
    return save_or_update_student(student)

@app.put("/api/students/{student_id}/report", response_model=Student)
def update_student_report(student_id: str, report: GeneratedReport):
    student = get_student_by_id(student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    student.report = report
    student.updated_at = datetime.now().isoformat()
    return save_or_update_student(student)

class ConfidentialityPayload(BaseModel):
    is_confidential: bool

@app.put("/api/students/{student_id}/confidentiality", response_model=Student)
def toggle_confidentiality(student_id: str, payload: ConfidentialityPayload):
    student = get_student_by_id(student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    student.is_confidential = payload.is_confidential
    student.updated_at = datetime.now().isoformat()
    return save_or_update_student(student)

class CommentPayload(BaseModel):
    author: str
    role: str
    text: str

@app.post("/api/students/{student_id}/comments", response_model=Student)
def add_comment(student_id: str, payload: CommentPayload):
    student = get_student_by_id(student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    new_comment = Comment(
        id=f"c-{uuid.uuid4().hex[:6]}",
        author=payload.author,
        role=payload.role,
        text=payload.text,
        timestamp=datetime.now().strftime("%d %b %Y, %I:%M %p")
    )
    student.comments.append(new_comment)
    student.updated_at = datetime.now().isoformat()
    return save_or_update_student(student)

@app.get("/api/students/{student_id}/export/docx")
def export_student_docx(student_id: str):
    student = get_student_by_id(student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    stream = generate_student_docx(student)
    filename = f"Saire_Ilmi_Report_{student.name.replace(' ', '_')}_{student.id}.docx"
    if student.is_confidential:
        filename = f"Saire_Ilmi_Report_Confidential_{student.id}.docx"

    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/api/cumulative", response_model=CumulativeReport)
def get_cumulative():
    return get_or_create_cumulative_report()

@app.post("/api/cumulative/generate", response_model=CumulativeReport)
def regenerate_cumulative():
    return get_or_create_cumulative_report()

@app.get("/api/cumulative/export/docx")
def export_cumulative_docx():
    cumulative = get_or_create_cumulative_report()
    stream = generate_cumulative_docx(cumulative)
    filename = f"Saire_Ilmi_Cohort_Conclusive_Dossier_{datetime.now().strftime('%Y%m%d')}.docx"
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

class ApiKeyPayload(BaseModel):
    api_key: str

@app.post("/api/settings/api-key")
def update_api_key(payload: ApiKeyPayload):
    set_api_key(payload.api_key)
    return {"status": "success", "has_key": bool(get_api_key())}

@app.get("/api/system/status")
def get_system_status():
    db_health = check_db_health()
    return {
        "database": db_health,
        "ai_engine": {
            "has_key": bool(get_api_key()),
            "type": "Gemini 2.5 Flash" if get_api_key() else "Built-in Expert Engine"
        }
    }

class DatabaseUrlPayload(BaseModel):
    database_url: str

@app.post("/api/settings/database-url")
def update_database_url(payload: DatabaseUrlPayload):
    set_runtime_database_url(payload.database_url)
    health = check_db_health()
    return health

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)

