import os
import json
import logging
from typing import List, Optional, Dict, Any
from models import Student, QuestionnaireData, ClinicalObservations, Comment, GeneratedReport, CumulativeReport
from gemini_service import generate_individual_report, generate_cumulative_report

logger = logging.getLogger(__name__)

DB_FILE = os.path.join(os.path.dirname(__file__), "students_db.json")
CUMULATIVE_FILE = os.path.join(os.path.dirname(__file__), "cumulative_db.json")

# Runtime override for database URL if updated in settings
RUNTIME_DATABASE_URL: Optional[str] = None

LAST_DB_ERROR: Optional[str] = None

def get_database_url() -> Optional[str]:
    return (
        RUNTIME_DATABASE_URL
        or os.getenv("DATABASE_URL")
        or os.getenv("POSTGRES_URL")
        or os.getenv("POSTGRESQL_URL")
        or os.getenv("RENDER_DATABASE_URL")
        or os.getenv("DB_URL")
    )

def set_runtime_database_url(url: str):
    global RUNTIME_DATABASE_URL
    RUNTIME_DATABASE_URL = url.strip() if url and url.strip() else None

def _get_pg_conn():
    global LAST_DB_ERROR
    db_url = get_database_url()
    if not db_url:
        LAST_DB_ERROR = "DATABASE_URL environment variable is not configured."
        return None

    url = db_url.strip()
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    last_err = ""

    # Strategy 1: psycopg2 directly
    try:
        import psycopg2
        conn = psycopg2.connect(url, connect_timeout=8)
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS app_storage (
                    key VARCHAR(64) PRIMARY KEY,
                    content TEXT NOT NULL
                );
            """)
        conn.commit()
        LAST_DB_ERROR = None
        return conn
    except Exception as e1:
        last_err = str(e1).strip()
        logger.warning(f"psycopg2 direct connection attempt: {last_err}")

    # Strategy 2: If SSL missing on cloud database, retry with sslmode=require
    if "ssl" not in url.lower() and not ("localhost" in url or "127.0.0.1" in url):
        try:
            import psycopg2
            separator = "&" if "?" in url else "?"
            ssl_url = f"{url}{separator}sslmode=require"
            conn = psycopg2.connect(ssl_url, connect_timeout=8)
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS app_storage (
                        key VARCHAR(64) PRIMARY KEY,
                        content TEXT NOT NULL
                    );
                """)
            conn.commit()
            LAST_DB_ERROR = None
            return conn
        except Exception as e2:
            last_err = str(e2).strip()
            logger.warning(f"psycopg2 with sslmode attempt: {last_err}")

    # Strategy 3: Pure-Python pg8000 fallback
    try:
        import pg8000.dbapi, urllib.parse, ssl
        parsed = urllib.parse.urlparse(url)
        ssl_ctx = None
        if "ssl" in url.lower() or not ("localhost" in url or "127.0.0.1" in url):
            ssl_ctx = ssl.create_default_context()
            ssl_ctx.check_hostname = False
            ssl_ctx.verify_mode = ssl.CERT_NONE

        conn = pg8000.dbapi.connect(
            user=urllib.parse.unquote(parsed.username or ""),
            password=urllib.parse.unquote(parsed.password or ""),
            host=parsed.hostname or "localhost",
            port=parsed.port or 5432,
            database=parsed.path.lstrip("/"),
            ssl_context=ssl_ctx,
            timeout=8
        )
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS app_storage (
                    key VARCHAR(64) PRIMARY KEY,
                    content TEXT NOT NULL
                );
            """)
        conn.commit()
        LAST_DB_ERROR = None
        return conn
    except Exception as e3:
        last_err = str(e3).strip()
        logger.error(f"pg8000 fallback attempt: {last_err}")

    LAST_DB_ERROR = last_err
    return None

def check_db_health() -> Dict[str, Any]:
    db_url = get_database_url()
    if not db_url:
        return {
            "connected": False,
            "mode": "local_ephemeral",
            "type": "Temporary Local File (Ephemeral)",
            "message": "DATABASE_URL is not configured in Render. Data is being saved to the local temporary container disk and will reset whenever Render restarts.",
            "url_configured": False
        }
    try:
        conn = _get_pg_conn()
        if not conn:
            safe_url = db_url.split("@")[-1] if "@" in db_url else "database"
            err_detail = LAST_DB_ERROR or "Unable to establish connection."
            return {
                "connected": False,
                "mode": "error",
                "type": "PostgreSQL (Connection Failed)",
                "message": f"Connection failed to '{safe_url}'. Detail: {err_detail}",
                "url_configured": True,
                "error_detail": err_detail
            }
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM app_storage;")
            count = cur.fetchone()[0]
        conn.close()
        return {
            "connected": True,
            "mode": "postgres_cloud",
            "type": "Cloud PostgreSQL (Permanent Storage)",
            "message": "Connected successfully! All student records, edits, and deletions are permanently stored in the cloud.",
            "url_configured": True,
            "items_count": count
        }
    except Exception as e:
        return {
            "connected": False,
            "mode": "error",
            "type": "PostgreSQL (Error)",
            "message": f"Database error: {str(e)}",
            "url_configured": True,
            "error_detail": str(e)
        }

def _init_seed_data() -> List[Student]:
    s1 = Student(
        id="SI-2026-001",
        name="Abbas Juzer bhai Malek",
        age=16,
        fathers_occupation="Business",
        mothers_occupation="Business",
        place="Raipur",
        batch="Batch 2026-A",
        is_confidential=False,
        status="Evaluated",
        questionnaire=QuestionnaireData(
            pre_session_query="",
            strengths_rely_on="Morning namaaz wake up, to hang clothes properly",
            weaknesses_not_rely_on="Household chores not doing sometimes",
            worry_overthink="Exam results _ switching to solution oriented thinking",
            enjoy_3_things="Cricket, friends, TV",
            insecure_uncomfortable="Laptop that is very dear, Ammi Abba, Dada Dadi",
            proud_of_yourself="My friends rely on me",
            confidence_source="Any competition in sports_ I'm prepared so I'm confident",
            feel_understood="Yes",
            go_to_person="Elder sister",
            parents_different="All okay",
            study_motivation="Both_ I have to and I like to",
            future_career="May be MBBS",
            adult_life_imagined="Life adventures _ solo travelling",
            fears_barriers_future="Not as such",
            alter_improve_self="Handwriting",
            magic_button_wish="Flying power I wish, want to fly like birds in the sky",
            session_feeling="Relaxing",
            unshared_thoughts="Nothing as such",
            takeaway="Nothing specific and got a good experience.",
            moula_guidance_practice="Not using phone much and reducing it_ I'm trying."
        ),
        observations=ClinicalObservations(
            emotional_expression="Fully Expressive",
            confidence_level="Confident",
            anxiety_restlessness="A little bit",
            clarity_vs_confusion="Clear",
            family_pressure_themes="No",
            fear_of_failure_judgement="Mild",
            motivational_level="High",
            identity_struggles="None Observed",
            peer_influence="Positive",
            emotional_maturity="Good"
        ),
        counsellor_raw_remarks="Seems all is good. Well-mannered and respectful.",
        prescribed_exercise_raw="1. Solution-oriented cognitive reframing journal.\n2. Handwriting refinement practice.\n3. Digital mindfulness log for screen time.",
        comments=[
            Comment(
                id="c-1",
                author="Program Management",
                role="Management",
                text="Excellent profile. Very glad to see his morning Namaaz discipline and focus on reducing screen time.",
                timestamp="12 Oct 2026, 10:45 AM"
            )
        ],
        created_at="2026-10-12T09:30:00",
        updated_at="2026-10-12T10:45:00"
    )
    s1.report = generate_individual_report(s1)

    s2 = Student(
        id="SI-2026-002",
        name="Mohammed Ali Asgar bhai Rangwala",
        age=15,
        fathers_occupation="Manufacturing Business",
        mothers_occupation="Homemaker",
        place="Mumbai",
        batch="Batch 2026-A",
        is_confidential=False,
        status="Follow-up Scheduled",
        questionnaire=QuestionnaireData(
            pre_session_query="How to stop worrying about 10th boards exam constantly?",
            strengths_rely_on="Helping others in studies, being punctual",
            weaknesses_not_rely_on="Public speaking or speaking in front of elders",
            worry_overthink="What if I don't score above 90% and disappoint father",
            enjoy_3_things="Reading, cycling alone, computer games",
            insecure_uncomfortable="When relatives ask about career plans and compare with cousins",
            proud_of_yourself="Never missed a session in madrasah",
            confidence_source="When I study thoroughly alone in silence",
            feel_understood="Sometimes, but parents have very high expectations",
            go_to_person="Nobody really, keep things to myself",
            parents_different="Wish father would listen more instead of advising immediately",
            study_motivation="Mostly pressure to maintain family standard",
            future_career="Software / Tech, but family wants me in hardware trade",
            adult_life_imagined="Independent, peaceful job without daily arguments",
            fears_barriers_future="Fear of letting down parents",
            alter_improve_self="Stop hesitating and learn to speak up",
            magic_button_wish="That everyone would understand what I truly want without getting upset",
            session_feeling="Relieved that I could talk openly without being judged",
            unshared_thoughts="Scared about the upcoming tests next month",
            takeaway="Learned that anxiety is natural but needs healthy outlets.",
            moula_guidance_practice="Trying to keep temper calm and recite Dua every morning."
        ),
        observations=ClinicalObservations(
            emotional_expression="Somewhat Constricted",
            confidence_level="Low to Fluctuating",
            anxiety_restlessness="High",
            clarity_vs_confusion="Somewhat Confused",
            family_pressure_themes="Yes",
            fear_of_failure_judgement="Severe",
            motivational_level="Moderate",
            identity_struggles="Moderate",
            peer_influence="Isolated",
            emotional_maturity="Developing"
        ),
        counsellor_raw_remarks="Carrying noticeable performance anxiety and perceived parental pressure. Tends to internalize stress. Needs emotional buffering and confidence building.",
        prescribed_exercise_raw="1. Deep breathing 4-7-8 routine before bed.\n2. Journaling 'Expectation vs Reality'.\n3. Scheduled 2nd counselling session on Day 5.",
        comments=[
            Comment(
                id="c-2",
                author="Lead Counsellor",
                role="Counsellor",
                text="Flagged for a second session. Will also coordinate with his dorm mentor to ensure he is socializing during sports hour.",
                timestamp="12 Oct 2026, 11:15 AM"
            )
        ],
        created_at="2026-10-12T10:00:00",
        updated_at="2026-10-12T11:30:00"
    )
    s2.report = generate_individual_report(s2)

    return [s1, s2]


def get_sample_student() -> Student:
    seeds = _init_seed_data()
    return seeds[0]


def load_students() -> List[Student]:
    conn = _get_pg_conn()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT content FROM app_storage WHERE key = 'students';")
                row = cur.fetchone()
                if row:
                    data = json.loads(row[0])
                    return [Student(**item) for item in data]
                else:
                    seeds = _init_seed_data()
                    save_students(seeds)
                    return seeds
        except Exception as e:
            logger.error(f"Error reading students from PostgreSQL: {e}")
        finally:
            conn.close()

    # Fallback to local JSON file
    if not os.path.exists(DB_FILE):
        seeds = _init_seed_data()
        save_students(seeds)
        return seeds
    try:
        with open(DB_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return [Student(**item) for item in data]
    except Exception:
        return []


def save_students(students: List[Student]):
    data_json = json.dumps([s.model_dump() for s in students], indent=2, ensure_ascii=False)
    
    conn = _get_pg_conn()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO app_storage (key, content)
                    VALUES ('students', %s)
                    ON CONFLICT (key) DO UPDATE SET content = EXCLUDED.content;
                """, (data_json,))
            conn.commit()
        except Exception as e:
            logger.error(f"Error saving students to PostgreSQL: {e}")
        finally:
            conn.close()

    # Also save locally
    try:
        with open(DB_FILE, "w", encoding="utf-8") as f:
            f.write(data_json)
    except Exception as e:
        logger.error(f"Error writing to local DB_FILE: {e}")


def get_student_by_id(student_id: str) -> Optional[Student]:
    students = load_students()
    for s in students:
        if s.id == student_id:
            return s
    return None


def save_or_update_student(student: Student) -> Student:
    students = load_students()
    updated = False
    for i, s in enumerate(students):
        if s.id == student.id:
            students[i] = student
            updated = True
            break
    if not updated:
        students.append(student)
    save_students(students)
    return student


def delete_student(student_id: str) -> bool:
    students = load_students()
    initial_len = len(students)
    students = [s for s in students if s.id != student_id]
    if len(students) < initial_len:
        save_students(students)
        return True
    return False


def get_or_create_cumulative_report() -> CumulativeReport:
    students = load_students()
    rep = generate_cumulative_report(students)
    data_json = json.dumps(rep.model_dump(), indent=2, ensure_ascii=False)

    conn = _get_pg_conn()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO app_storage (key, content)
                    VALUES ('cumulative', %s)
                    ON CONFLICT (key) DO UPDATE SET content = EXCLUDED.content;
                """, (data_json,))
            conn.commit()
        except Exception as e:
            logger.error(f"Error saving cumulative report to PostgreSQL: {e}")
        finally:
            conn.close()

    try:
        with open(CUMULATIVE_FILE, "w", encoding="utf-8") as f:
            f.write(data_json)
    except Exception:
        pass
    return rep
