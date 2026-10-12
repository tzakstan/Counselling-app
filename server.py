import os
import uuid
from datetime import datetime
from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional

from models import Student, GeneratedReport, Comment, CumulativeReport
from data_store import (
    load_students,
    get_student_by_id,
    save_or_update_student,
    get_or_create_cumulative_report
)
from gemini_service import (
    generate_individual_report,
    set_api_key,
    get_api_key
)
from docx_generator import generate_student_docx, generate_cumulative_docx

app = FastAPI(title="Saire Ilmi Counselling & Evaluation System")

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

@app.get("/api/settings/api-key")
def check_api_key():
    return {"has_key": bool(get_api_key())}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)

